import type { ReadConcernLevel, ReadPreferenceMode } from 'mongodb';
import type { ClientSession } from 'mongoose';
import type { DatabaseTransaction } from '../../transactions/DatabaseTransaction.js';
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
import { ModuleError } from '@conduitplatform/module-tools';
import { DOCUMENT_NOT_MODIFIABLE, errors } from '../../errors.js';

export class MongooseSchema extends SchemaAdapter<Model<any>> {
  model: Model<any>;
  // todo rename
  declare fieldHash: string;

  /** Per-schema MongoDB read preference from `modelOptions.conduit.readPreference`. */
  private readonly schemaLevelReadPreference?: string;

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
    const mo = cloneDeep(schema.modelOptions ?? {}) as Indexable;
    let schemaRp: string | undefined;
    if (mo.conduit && typeof mo.conduit === 'object') {
      const conduit = mo.conduit as Indexable;
      const rawRp = conduit.readPreference;
      if (rawRp != null && String(rawRp).length > 0) {
        schemaRp = String(rawRp);
        delete conduit.readPreference;
      }
    }
    this.schemaLevelReadPreference = schemaRp;
    const mongooseSchema = new Schema(cloneDeep(schema.fields as Indexable), {
      ...mo,
      autoCreate: false,
      autoIndex: false,
    });
    this.model = mongoose.model(cloneDeep(schema.name), mongooseSchema);
  }

  parseStringToQuery(
    query: Query | SingleDocQuery | MultiDocQuery,
  ): ParsedQuery | ParsedQuery[] {
    return typeof query === 'string' ? JSON.parse(query) : query;
  }

  private sessionOf(options?: {
    transaction?: DatabaseTransaction;
  }): ClientSession | undefined {
    return options?.transaction?.native as ClientSession | undefined;
  }

  /** Write options for a single operation. The concern of a transaction is set when it starts. */
  private writeOptions(session?: ClientSession) {
    if (session) return { session };
    const wc = this.effectiveWriteConcern;
    return wc ? { writeConcern: wc } : undefined;
  }

  private get effectiveWriteConcern(): { w: 'majority' } | { w: number } | undefined {
    const wc = this.adapter.getQueryDefaults().writeConcern;
    if (!wc || wc === '1') return undefined;
    if (wc === 'majority') return { w: 'majority' };
    return { w: parseInt(wc, 10) };
  }

  private applyReplicaReadRouting(
    q: MongooseQuery<any, any, {}, any>,
    readPreference?: string,
    session?: ClientSession,
  ) {
    // Reads in a transaction go to the primary with the transaction's read concern.
    if (session) return q.session(session);
    const d = this.adapter.getQueryDefaults();
    const effectiveReadPref =
      readPreference ?? this.schemaLevelReadPreference ?? d.readPreference;
    let out = q;
    if (effectiveReadPref && effectiveReadPref !== 'primary') {
      out = out.read(effectiveReadPref as ReadPreferenceMode);
    }
    const rc = d.readConcern;
    if (rc && rc !== 'local') {
      out = out.readConcern(rc as ReadConcernLevel);
    }
    return out;
  }

  async create(
    query: SingleDocQuery,
    options?: {
      transaction?: DatabaseTransaction;
      scope?: string;
      userId?: string;
    },
  ) {
    await this.createPermissionCheck(options?.userId, options?.scope);
    const parsedQuery = this.parseStringToQuery(query);

    const writeOptions = this.writeOptions(this.sessionOf(options));
    const created = writeOptions
      ? await this.model.create([parsedQuery] as object[], writeOptions)
      : await this.model.create(parsedQuery as object);
    const obj = (Array.isArray(created) ? created[0] : created).toObject();
    await this.addPermissionToData(obj, options);
    return obj;
  }

  async createMany(
    query: MultiDocQuery,
    options?: {
      transaction?: DatabaseTransaction;
      scope?: string;
      userId?: string;
    },
  ): Promise<any> {
    await this.createPermissionCheck(options?.userId, options?.scope);
    const parsed = this.parseStringToQuery(query);
    const docs = Array.isArray(parsed) ? parsed : [parsed];
    const writeOptions = this.writeOptions(this.sessionOf(options));
    const addedDocs = writeOptions
      ? await this.model.insertMany(docs, writeOptions as any)
      : await this.model.insertMany(docs);
    await this.addPermissionToData(addedDocs, options);
    return addedDocs;
  }

  async findByIdAndUpdate(
    id: string,
    query: SingleDocQuery,
    options?: {
      transaction?: DatabaseTransaction;
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
      transaction?: DatabaseTransaction;
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
      transaction?: DatabaseTransaction;
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
      options?.transaction,
    );
    if (isNil(parsedFilter)) {
      throw new ModuleError(DOCUMENT_NOT_MODIFIABLE);
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    let finalQuery = this.model.findOneAndReplace(parsedFilter!, parsedQuery, {
      returnDocument: 'after',
      ...this.writeOptions(this.sessionOf(options)),
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
      transaction?: DatabaseTransaction;
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
      options?.transaction,
    );
    if (isNil(parsedFilter)) {
      throw new ModuleError(DOCUMENT_NOT_MODIFIABLE);
    }
    let parsedQuery: ParsedQuery = this.parseStringToQuery(query);
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    let finalQuery = this.model.findOneAndUpdate(parsedFilter!, parsedQuery, {
      returnDocument: 'after',
      ...this.writeOptions(this.sessionOf(options)),
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
      transaction?: DatabaseTransaction;
      populate?: string[];
      userId?: string;
      scope?: string;
    },
  ) {
    let parsedFilter: Indexable | null = parseQuery(this.parseStringToQuery(filterQuery));
    parsedFilter = await this.getAuthorizedQuery(
      'edit',
      parsedFilter,
      true,
      options?.userId,
      options?.scope,
      options?.transaction,
    );
    if (isNil(parsedFilter)) {
      return [];
    }
    let parsedQuery: Indexable = this.parseStringToQuery(query);
    if (parsedQuery.hasOwnProperty('$set')) {
      parsedQuery = parsedQuery['$set'];
    }
    return this.model
      .updateMany(parsedFilter, parsedQuery, this.writeOptions(this.sessionOf(options)))
      .exec();
  }

  async deleteOne(
    query: Query,
    options?: {
      transaction?: DatabaseTransaction;
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
      options?.transaction,
    );
    if (isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .deleteOne(parsedQuery!, this.writeOptions(this.sessionOf(options)))
      .exec()
      .then(r => ({ deletedCount: r.deletedCount }));
  }

  async deleteMany(
    query: Query,
    options?: {
      transaction?: DatabaseTransaction;
      userId?: string;
      scope?: string;
    },
  ) {
    let parsedQuery: Indexable | null = parseQuery(this.parseStringToQuery(query));
    parsedQuery = await this.getAuthorizedQuery(
      'delete',
      parsedQuery,
      true,
      options?.userId,
      options?.scope,
      options?.transaction,
    );
    if (isNil(parsedQuery)) {
      return { deletedCount: 0 };
    }
    return this.model
      .deleteMany(parsedQuery, this.writeOptions(this.sessionOf(options)))
      .exec()
      .then(r => ({ deletedCount: r.deletedCount }));
  }

  async findMany(
    query: Query,
    options?: {
      transaction?: DatabaseTransaction;
      skip?: number;
      limit?: number;
      select?: string;
      sort?: { [field: string]: -1 | 1 };
      populate?: string[];
      userId?: string;
      scope?: string;
      readPreference?: string;
    },
  ): Promise<any> {
    const { query: filter, modified } = await this.getPaginatedAuthorizedQuery(
      'read',
      parseQuery(this.parseStringToQuery(query)),
      options?.userId,
      options?.scope,
      options?.skip,
      options?.limit,
      options?.sort,
      options?.transaction,
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
    finalQuery = this.applyReplicaReadRouting(
      finalQuery,
      options?.readPreference,
      this.sessionOf(options),
    );
    return finalQuery.lean().exec();
  }

  async findOne(
    query: Query,
    options?: {
      transaction?: DatabaseTransaction;
      userId?: string;
      scope?: string;
      select?: string;
      populate?: string[];
      readPreference?: string;
    },
  ): Promise<any> {
    const parsedQuery: Indexable | null = parseQuery(this.parseStringToQuery(query));
    const filter = await this.getAuthorizedQuery(
      'read',
      parsedQuery,
      false,
      options?.userId,
      options?.scope,
      options?.transaction,
    );
    if (isNil(filter) && !isNil(parsedQuery)) {
      return null;
    }
    let finalQuery = this.model.findOne(filter!, options?.select);
    if (options?.populate !== undefined && options?.populate !== null) {
      finalQuery = this.populate(finalQuery, options?.populate);
    }
    finalQuery = this.applyReplicaReadRouting(
      finalQuery,
      options?.readPreference,
      this.sessionOf(options),
    );
    return finalQuery.lean().exec();
  }

  async countDocuments(
    query: Query,
    options?: {
      transaction?: DatabaseTransaction;
      userId?: string;
      scope?: string;
      readPreference?: string;
    },
  ) {
    if (!isNil(options?.userId) || !isNil(options?.scope)) {
      const view = await this.permissionCheck('read', options?.userId, options?.scope);
      if (view) {
        return view.countDocuments(query, {
          userId: undefined,
          scope: undefined,
          readPreference: options?.readPreference,
          transaction: options?.transaction,
        });
      }
    }
    const parsedQuery = parseQuery(this.parseStringToQuery(query));
    let query_ = this.applyReplicaReadRouting(
      this.model.find(parsedQuery),
      options?.readPreference,
      this.sessionOf(options),
    );
    return query_.countDocuments().exec();
  }

  async columnExistence(columns: string[]): Promise<boolean> {
    const array: object[] = [];
    for (const column of columns) {
      array.push({ [column]: { $exists: true } });
    }
    const result = await this.model.db
      .collection(this.originalSchema.collectionName)
      .findOne({ $and: array }, { readPreference: 'primary' });
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
            throw new ModuleError({
              ...errors.POPULATE_INVALID,
              message: "Failed populating '" + final + "'",
            });
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
          throw new ModuleError({
            ...errors.POPULATE_INVALID,
            message: `Failed populating '${final}', path exists for ${processing} but missing ${
              final.split(processing)[1]
            }`,
          });
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
