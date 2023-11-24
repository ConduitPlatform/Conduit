import {
  Model,
  Mongoose,
  PipelineStage,
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
} from '../../interfaces';
import { MongooseAdapter } from './index';
import ConduitGrpcSdk, {
  ConduitSchema,
  Indexable,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { cloneDeep, isEmpty, isNil } from 'lodash';
import { parseQuery } from './parser';

const EJSON = require('mongodb-extended-json');

export class MongooseSchema extends SchemaAdapter<Model<any>> {
  model: Model<any>;
  fieldHash: string;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    mongoose: Mongoose,
    readonly schema: ConduitSchema,
    readonly originalSchema: any,
    readonly adapter: MongooseAdapter,
    isView: boolean = false,
  ) {
    super(grpcSdk, adapter, isView);
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
    return typeof query === 'string' ? EJSON.parse(query) : query;
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
  ) {
    const parsedFilterQuery = parseQuery(this.parseStringToQuery(filterQuery));
    const { parsedQuery: parsedFilter } = await this.getAuthorizedIdsQuery(
      parsedFilterQuery,
      'edit',
      options,
    );
    if (isNil(parsedFilter) && !isNil(filterQuery)) {
      throw new Error("Document doesn't exist or can't be modified by user.");
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery && parsedQuery.hasOwnProperty('$set')) {
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
    const parsedFilterQuery = parseQuery(this.parseStringToQuery(filterQuery));
    const parsedFilter = await this.getAuthorizedIdsQuery(
      parsedFilterQuery,
      'edit',
      options,
    ).then(r => r.parsedQuery);
    if (isNil(parsedFilter) && !isNil(filterQuery)) {
      throw new Error("Document doesn't exist or can't be modified by user.");
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery && parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    let finalQuery = this.model.findOneAndUpdate(parsedFilter ?? {}, parsedQuery ?? {}, {
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
    const parsedFilterQuery = parseQuery(this.parseStringToQuery(filterQuery));
    const parsedFilter = await this.getAuthorizedIdsQuery(
      parsedFilterQuery,
      'edit',
      options,
    ).then(r => r.parsedQuery);
    if (isNil(parsedFilter) && !isNil(parsedFilterQuery)) {
      return [];
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery && parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    return this.model.updateMany(parsedFilter ?? {}, parsedQuery ?? {}).exec();
  }

  async deleteOne(
    query: Query,
    options?: {
      userId?: string;
      scope?: string;
    },
  ) {
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
    const { parsedQuery: parsedFilter } = await this.getAuthorizedIdsQuery(
      parsedQuery,
      'delete',
      options,
    );
    if (isNil(parsedFilter) && !isNil(query)) {
      return { deletedCount: 0 };
    }
    return this.model
      .deleteOne(parsedFilter!)
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
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
    const { parsedQuery: parsedFilter } = await this.getAuthorizedIdsQuery(
      parsedQuery,
      'delete',
      options,
    );
    if (isNil(parsedFilter) && !isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .deleteMany(parsedFilter ?? {})
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
  ) {
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
    const { parsedQuery: parsedFilter, modified } = await this.getAuthorizedIdsQuery(
      parsedQuery,
      'read',
      options,
    );
    if (isNil(parsedFilter) && !isNil(parsedQuery)) {
      return [];
    }
    let finalQuery = this.model.find(parsedFilter ?? {}, options?.select);
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
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
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
    let finalQuery = this.model.findOne(parsedQuery!, options?.select);
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
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
    if (!isNil(options?.userId) || !isNil(options?.scope)) {
      const authorizedPipeline = await this.getAuthorizedPipeline(
        'read',
        options?.userId,
        options?.scope,
      );
      if (!isEmpty(authorizedPipeline)) {
        authorizedPipeline.push(
          ...[
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
              },
            },
          ],
        );
        const pipeline = this.constructAggregationPipeline(
          parsedQuery,
          authorizedPipeline,
        );
        return this.model
          .aggregate(pipeline as PipelineStage[])
          .then(r => (!isEmpty(r) ? r[0].count : 0));
      }
    }
    return this.model
      .find(parsedQuery ?? {})
      .countDocuments()
      .exec();
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
    population.forEach((r: string | string[]) => {
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

  private constructAggregationPipeline(
    parsedQuery: ParsedQuery,
    authorizedQueryPipeline: object[],
    options?: {
      skip?: number;
      limit?: number;
      select?: string;
      sort?: { [p: string]: number };
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ) {
    const pipeline = [{ $match: parsedQuery }, ...authorizedQueryPipeline];
    if (!isNil(options?.skip)) {
      pipeline.push({ $skip: options?.skip });
    }
    if (!isNil(options?.limit)) {
      pipeline.push({ $limit: options?.limit });
    }
    if (!isNil(options?.sort)) {
      pipeline.push({ $sort: this.parseSort(options!.sort) });
    }
    return pipeline;
  }

  private async getAuthorizedPipeline(
    operation: string,
    userId?: string,
    scope?: string,
  ) {
    if (
      !this.originalSchema.modelOptions.conduit?.authorization?.enabled ||
      (isNil(userId) && isNil(scope))
    ) {
      return [];
    }
    const isAvailable = this.grpcSdk.isAvailable('authorization');
    if (!isAvailable) {
      throw new Error('Authorization service is not available');
    }
    if (scope) {
      if (userId) {
        const allowed = await this.grpcSdk.authorization?.can({
          subject: `User:${userId}`,
          actions: [operation],
          resource: scope,
        });
        if (!allowed?.allow) {
          throw new Error(`User:${userId} is not allowed to ${operation} ${scope}`);
        }
      }
    }
    const query = await this.grpcSdk.authorization!.getAuthorizedQuery({
      subject: scope ?? `User:${userId}`,
      action: operation,
      resourceType: this.originalSchema.name,
    });
    return query.mongoQuery;
  }

  private async getAuthorizedIdsQuery(
    parsedQuery: ParsedQuery,
    operation: string,
    options?: {
      skip?: number;
      limit?: number;
      select?: string;
      sort?: { [p: string]: number };
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ) {
    const authorizedPipeline = await this.getAuthorizedPipeline(
      operation,
      options?.userId,
      options?.scope,
    );
    if (isEmpty(authorizedPipeline)) {
      return { parsedQuery, modified: false };
    }
    const pipeline = this.constructAggregationPipeline(
      parsedQuery,
      authorizedPipeline,
      options,
    );
    const ids = await this.model
      .aggregate(pipeline as PipelineStage[])
      .then(r => r.map(r => r._id));
    if (isEmpty(ids)) {
      return { parsedQuery: null, modified: false };
    }
    return { parsedQuery: { _id: { $in: ids } }, modified: true };
  }
}
