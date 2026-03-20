import {
  Model,
  Mongoose,
  PopulateOptions,
  Query as MongooseQuery,
  Schema,
  SortOrder,
} from 'mongoose';
import {
  _ConduitSchema,
  _ConduitSchemaOptions,
  MultiDocQuery,
  ParsedQuery,
  Query,
  SchemaAdapter,
  SingleDocQuery,
} from '../../interfaces/index.js';
import { MongooseAdapter } from './index.js';
import {
  ConduitGrpcSdk,
  ConduitSchema,
  Indexable,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { cloneDeep, isNil } from 'lodash-es';
import { parseQuery } from './parser/index.js';
import { AuthzBulkMaxTotalIdsError } from '../utils/authorizedBulkConfig.js';
import {
  iterateAuthorizedMongoIdBatches,
  mergeMongoBulkFilterWithIdIn,
} from '../utils/authorizedBulkMongo.js';
import {
  recordAuthorizedBulkCapErrorMetrics,
  recordAuthorizedBulkOperationMetrics,
} from '../utils/authorizedBulkMetrics.js';

export class MongooseSchema extends SchemaAdapter<Model<any>> {
  model: Model<any>;
  // todo rename
  declare fieldHash: string;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    mongoose: Mongoose,
    readonly schema: ConduitSchema,
    readonly originalSchema: any,
    readonly adapter: MongooseAdapter,
    isView: boolean = false,
    readonly viewQuery?: Indexable,
  ) {
    super(grpcSdk, adapter, isView);
    if (viewQuery) {
      this.viewQuery = viewQuery;
    }
    if (!isNil(schema.collectionName)) {
      (schema.modelOptions as _ConduitSchemaOptions).collection = schema.collectionName; // @dirty-type-cast
    } else {
      (schema as _ConduitSchema).collectionName = schema.name; //restore collectionName
    }
    const mongooseSchema = new Schema(cloneDeep(schema.fields as Indexable), {
      ...cloneDeep(schema.modelOptions),
      ...(isView
        ? {
            autoCreate: false,
            autoIndex: false,
          }
        : {}),
    });
    this.model = mongoose.model(cloneDeep(schema.name), mongooseSchema);
  }

  parseStringToQuery(
    query: Query | SingleDocQuery | MultiDocQuery,
  ): ParsedQuery | ParsedQuery[] {
    return typeof query === 'string' ? JSON.parse(query) : query;
  }

  async create(
    query: SingleDocQuery,
    options?: {
      scope?: string;
      userId?: string;
    },
  ) {
    await this.createPermissionCheck(options?.userId, options?.scope);
    const parsedQuery = this.parseStringToQuery(query);

    const obj = await this.model.create(parsedQuery).then(r => r.toObject());
    await this.addPermissionToData(obj, options);
    return obj;
  }

  async createMany(
    query: MultiDocQuery,
    options?: {
      scope?: string;
      userId?: string;
    },
  ) {
    await this.createPermissionCheck(options?.userId, options?.scope);
    const docs = this.parseStringToQuery(query);
    const addedDocs = await this.model.insertMany(docs);
    await this.addPermissionToData(addedDocs, options);
    return addedDocs;
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ) {
    return this.updateOne({ _id: id }, query, options);
  }

  async findByIdAndReplace(
    id: string,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ) {
    return this.replaceOne({ _id: id }, query, options);
  }

  async replaceOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any> {
    let parsedFilter: Indexable | null = parseQuery(this.parseStringToQuery(filterQuery));
    parsedFilter = await this.getAuthorizedQuery(
      'edit',
      parsedFilter,
      false,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedFilter)) {
      throw new Error("Document doesn't exist or can't be modified by user.");
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    let finalQuery = this.model.findOneAndReplace(parsedFilter!, parsedQuery, {
      new: true,
    });
    if (options?.populate !== undefined && options?.populate !== null) {
      finalQuery = this.populate(finalQuery, options?.populate);
    }
    return finalQuery.lean().exec();
  }

  async updateOne(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      userId?: string;
      scope?: string;
      populate?: string[];
    },
  ): Promise<any> {
    let parsedFilter: Indexable | null = parseQuery(this.parseStringToQuery(filterQuery));
    parsedFilter = await this.getAuthorizedQuery(
      'edit',
      parsedFilter,
      false,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedFilter)) {
      throw new Error("Document doesn't exist or can't be modified by user.");
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    let finalQuery = this.model.findOneAndUpdate(parsedFilter!, parsedQuery, {
      new: true,
    });
    if (options?.populate !== undefined && options?.populate !== null) {
      finalQuery = this.populate(finalQuery, options?.populate);
    }
    return finalQuery.lean().exec();
  }

  async updateMany(
    filterQuery: Query,
    query: SingleDocQuery,
    options?: {
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ) {
    let parsedFilter: Indexable | null = parseQuery(this.parseStringToQuery(filterQuery));
    let parsedQuery: Indexable = this.parseStringToQuery(query);
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }

    if (
      this.authzEnabled &&
      this.adapter.getDatabaseType() === 'MongoDB' &&
      (!isNil(options?.userId) || !isNil(options?.scope))
    ) {
      try {
        const view = await this.permissionCheck('edit', options?.userId, options?.scope);
        if (view && view instanceof MongooseSchema) {
          const start = Date.now();
          let chunkCount = 0;
          let matchedCount = 0;
          let modifiedCount = 0;
          for await (const idBatch of iterateAuthorizedMongoIdBatches(
            view.model,
            parsedFilter!,
          )) {
            chunkCount++;
            const chunkFilter = mergeMongoBulkFilterWithIdIn(parsedFilter!, idBatch);
            const r = await this.model.updateMany(chunkFilter, parsedQuery).exec();
            matchedCount += r.matchedCount ?? (r as { n?: number }).n ?? 0;
            modifiedCount +=
              r.modifiedCount ?? (r as { nModified?: number }).nModified ?? 0;
          }
          if (chunkCount > 0) {
            recordAuthorizedBulkOperationMetrics({
              operation: 'updateMany',
              schemaName: this.originalSchema.name,
              chunkCount,
              durationMs: Date.now() - start,
            });
          }
          if (chunkCount === 0) {
            return [];
          }
          return {
            acknowledged: true,
            matchedCount,
            modifiedCount,
          };
        }
      } catch (e) {
        if (e instanceof AuthzBulkMaxTotalIdsError) {
          recordAuthorizedBulkCapErrorMetrics({
            operation: 'updateMany',
            schemaName: this.originalSchema.name,
          });
        }
        throw e;
      }
    }

    parsedFilter = await this.getAuthorizedQuery(
      'edit',
      parsedFilter,
      true,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedFilter)) {
      return [];
    }
    return this.model.updateMany(parsedFilter, parsedQuery).exec();
  }

  async deleteOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ) {
    let parsedQuery: Indexable | null = parseQuery(this.parseStringToQuery(query));
    parsedQuery = await this.getAuthorizedQuery(
      'delete',
      parsedQuery,
      false,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .deleteOne(parsedQuery!)
      .exec()
      .then(r => ({ deletedCount: r.deletedCount }));
  }

  async deleteMany(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ) {
    let parsedQuery: Indexable | null = parseQuery(this.parseStringToQuery(query));

    if (
      this.authzEnabled &&
      this.adapter.getDatabaseType() === 'MongoDB' &&
      (!isNil(options?.userId) || !isNil(options?.scope))
    ) {
      try {
        const view = await this.permissionCheck(
          'delete',
          options?.userId,
          options?.scope,
        );
        if (view && view instanceof MongooseSchema) {
          const start = Date.now();
          let chunkCount = 0;
          let deletedCount = 0;
          for await (const idBatch of iterateAuthorizedMongoIdBatches(
            view.model,
            parsedQuery!,
          )) {
            chunkCount++;
            const chunkFilter = mergeMongoBulkFilterWithIdIn(parsedQuery!, idBatch);
            const r = await this.model.deleteMany(chunkFilter).exec();
            deletedCount += r.deletedCount ?? 0;
          }
          if (chunkCount > 0) {
            recordAuthorizedBulkOperationMetrics({
              operation: 'deleteMany',
              schemaName: this.originalSchema.name,
              chunkCount,
              durationMs: Date.now() - start,
            });
          }
          return { deletedCount };
        }
      } catch (e) {
        if (e instanceof AuthzBulkMaxTotalIdsError) {
          recordAuthorizedBulkCapErrorMetrics({
            operation: 'deleteMany',
            schemaName: this.originalSchema.name,
          });
        }
        throw e;
      }
    }

    parsedQuery = await this.getAuthorizedQuery(
      'delete',
      parsedQuery,
      true,
      options?.userId,
      options?.scope,
    );
    if (isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .deleteMany(parsedQuery)
      .exec()
      .then(r => ({ deletedCount: r.deletedCount }));
  }

  async findMany(
    query: Query,
    options?: {
      skip?: number;
      limit?: number;
      select?: string;
      sort?: { [field: string]: -1 | 1 };
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ): Promise<any> {
    const parsedFilter = parseQuery(this.parseStringToQuery(query));
    // View-direct reads: one query against the auth view with user filter + pagination (no giant _id $in).
    if (
      this.authzEnabled &&
      this.adapter.getDatabaseType() === 'MongoDB' &&
      (!isNil(options?.userId) || !isNil(options?.scope))
    ) {
      const view = await this.permissionCheck('read', options?.userId, options?.scope);
      if (view && view instanceof MongooseSchema) {
        ConduitGrpcSdk.Metrics?.increment('database_authorized_view_reads_total');
        let finalQuery = view.model.find(parsedFilter, options?.select);
        if (!isNil(options?.skip)) {
          finalQuery = finalQuery.skip(options!.skip!);
        }
        if (!isNil(options?.limit)) {
          finalQuery = finalQuery.limit(options!.limit!);
        }
        if (!isNil(options?.sort)) {
          finalQuery = finalQuery.sort(this.parseSort(options!.sort));
        }
        if (!isNil(options?.populate)) {
          finalQuery = this.populate(finalQuery, options!.populate ?? []);
        }
        return finalQuery.lean().exec();
      }
    }

    const { query: filter, modified } = await this.getPaginatedAuthorizedQuery(
      'read',
      parsedFilter,
      options?.userId,
      options?.scope,
      options?.skip,
      options?.limit,
      options?.sort,
    );
    if (isNil(filter)) {
      return [];
    }
    let finalQuery = this.model.find(filter, options?.select);
    if (!isNil(options?.skip) && !modified) {
      finalQuery = finalQuery.skip(options!.skip!);
    }
    if (!isNil(options?.limit) && !modified) {
      finalQuery = finalQuery.limit(options!.limit!);
    }
    if (!isNil(options?.populate)) {
      finalQuery = this.populate(finalQuery, options!.populate ?? []);
    }
    if (!isNil(options?.sort)) {
      finalQuery = finalQuery.sort(this.parseSort(options!.sort));
    }
    return finalQuery.lean().exec();
  }

  async findOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
      select?: string;
      populate?: string[];
    },
  ): Promise<any> {
    const parsedQuery: Indexable | null = parseQuery(this.parseStringToQuery(query));
    if (
      this.authzEnabled &&
      this.adapter.getDatabaseType() === 'MongoDB' &&
      (!isNil(options?.userId) || !isNil(options?.scope))
    ) {
      const view = await this.permissionCheck('read', options?.userId, options?.scope);
      if (view && view instanceof MongooseSchema) {
        ConduitGrpcSdk.Metrics?.increment('database_authorized_view_reads_total');
        let finalQuery = view.model.findOne(parsedQuery!, options?.select);
        if (options?.populate !== undefined && options?.populate !== null) {
          finalQuery = this.populate(finalQuery, options?.populate);
        }
        return finalQuery.lean().exec();
      }
    }

    const filter = await this.getAuthorizedQuery(
      'read',
      parsedQuery,
      false,
      options?.userId,
      options?.scope,
    );
    if (isNil(filter) && !isNil(parsedQuery)) {
      return null;
    }
    let finalQuery = this.model.findOne(filter!, options?.select);
    if (options?.populate !== undefined && options?.populate !== null) {
      finalQuery = this.populate(finalQuery, options?.populate);
    }
    return finalQuery.lean().exec();
  }

  async countDocuments(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ) {
    if (!isNil(options?.userId) || !isNil(options?.scope)) {
      const view = await this.permissionCheck('read', options?.userId, options?.scope);
      if (view) {
        return view.countDocuments(query, {
          userId: undefined,
          scope: undefined,
        });
      }
    }
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
    return this.model.find(parsedQuery).countDocuments().exec();
  }

  async columnExistence(columns: string[]): Promise<boolean> {
    const array: object[] = [];
    for (const column of columns) {
      array.push({ [column]: { $exists: true } });
    }
    const result = await this.model.db
      .collection(this.originalSchema.collectionName)
      .findOne({ $and: array });
    return result !== null;
  }

  public calculatePopulates(population: string[]) {
    const populates: (string | PopulateOptions)[] = [];
    population.forEach((r: string | string[], index: number) => {
      const final = r.toString().trim();
      if (final.indexOf('.') !== -1) {
        let controlBool = true;
        let processing = cloneDeep(final);
        let validPath;
        while (controlBool) {
          if (this.model.schema.paths[processing]) {
            validPath = this.model.schema.paths[processing];
            controlBool = false;
          } else if ((this.model.schema as any).subpaths[processing]) {
            validPath = (this.model.schema as any).subpaths[processing];
            controlBool = false;
          } else if (
            processing === undefined ||
            processing.length === 0 ||
            processing === ''
          ) {
            throw new Error("Failed populating '" + final + "'");
          } else {
            const split = processing.split('.');
            split.splice(split.length - 1, 1);
            processing = split.join('.');
          }
        }
        if (processing === final) {
          populates.push(processing);
        } else if (
          validPath.options.ref === undefined &&
          validPath.options.type[0].ref === undefined
        ) {
          throw new Error(
            `Failed populating '${final}', path exists for ${processing} but missing ${
              final.split(processing)[1]
            }`,
          );
        } else {
          const ref = validPath.options.ref || validPath.options.type[0].ref;
          const childPopulates = this.adapter.models[ref].calculatePopulates([
            final.replace(processing + '.', ''),
          ]);
          if (populates.indexOf(processing) !== -1) {
            populates.splice(populates.indexOf(processing), 1);
            populates.push({ path: processing, populate: childPopulates });
          } else {
            const found = populates.filter(r => {
              if (
                typeof r === 'object' &&
                r.hasOwnProperty('path') &&
                r['path'] === processing
              ) {
                if (!r.hasOwnProperty('populate')) {
                  r['populate'] = childPopulates;
                } else {
                  r['populate'] = (r['populate']! as UntypedArray).concat(childPopulates);
                }
                return true;
              }
              return false;
            });
            if (found.length === 0) {
              populates.push({ path: processing, populate: childPopulates });
            }
          }
        }
      } else {
        populates.push(final);
      }
    });
    return populates;
  }

  public populate(queryObj: MongooseQuery<any, any>, population: string[]) {
    const populates = this.calculatePopulates(population);
    for (const populate of populates) {
      if (typeof populate === 'object') {
        queryObj = queryObj.populate(populate as PopulateOptions);
      } else {
        queryObj = queryObj.populate(populate as string);
      }
    }
    return queryObj;
  }

  private parseSort(sort: { [key: string]: number }): { [p: string]: SortOrder } {
    return sort as { [p: string]: SortOrder };
  }
}
