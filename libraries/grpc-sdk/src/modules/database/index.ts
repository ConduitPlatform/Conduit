import { ConduitModule, ConduitSchema } from '../../classes/index.js';
import {
  DatabaseProviderDefinition,
  DropCollectionResponse,
  Schema,
} from '../../protoUtils/database.js';
import {
  ConduitSchemaExtension,
  Indexable,
  RawQuery,
  UntypedArray,
} from '../../interfaces/index.js';
import { Query } from '../../types/db.js';
import type { FindOneOptions, FindManyOptions } from './types.js';
export type { FindOneOptions, FindManyOptions } from './types.js';
import { AuthzOptions, PopulateAuthzOptions } from '../../types/options.js';

export type CountDocumentsOptions = AuthzOptions & { readPreference?: string };

function toPopulateArray(populate?: string | string[]): string[] {
  if (!populate) return [];
  return Array.isArray(populate) ? populate : [populate];
}

export class DatabaseProvider extends ConduitModule<typeof DatabaseProviderDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'database', url, grpcToken);
    this.initializeClient(DatabaseProviderDefinition);
  }

  getSchema(schemaName: string): Promise<{
    name: string;
    fields: any;
    modelOptions: any;
    collectionName: string;
    fieldHash: string;
  }> {
    return this.client!.getSchema({ schemaName: schemaName }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
        collectionName: res.collectionName,
        fieldHash: res.fieldHash,
      };
    });
  }

  getSchemas(): Promise<
    {
      name: string;
      fields: any;
      modelOptions: any;
      fieldHash: string;
    }[]
  > {
    return this.client!.getSchemas({}).then(res => {
      return res.schemas.map(
        (schema: {
          name: string;
          fields: string;
          modelOptions: string;
          collectionName: string;
          fieldHash: string;
        }) => {
          return {
            name: schema.name,
            fields: JSON.parse(schema.fields),
            modelOptions: JSON.parse(schema.modelOptions),
            collectionName: schema.collectionName,
            fieldHash: schema.fieldHash,
          };
        },
      );
    });
  }

  deleteSchema(schemaName: string, deleteData: boolean): Promise<DropCollectionResponse> {
    return this.client!.deleteSchema({ schemaName, deleteData });
  }

  createSchemaFromAdapter(schema: ConduitSchema): Promise<Schema> {
    return this.client!.createSchemaFromAdapter({
      name: schema.name,
      fields: JSON.stringify(schema.fields),
      modelOptions: JSON.stringify(schema.modelOptions),
      collectionName: schema.collectionName,
    }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
        collectionName: res.collectionName,
        fieldHash: res.fieldHash,
      };
    });
  }

  setSchemaExtension(extension: ConduitSchemaExtension): Promise<Schema> {
    return this.client!.setSchemaExtension({
      schemaName: extension.schemaName,
      fields: JSON.stringify(extension.fields),
    }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
        collectionName: res.collectionName,
        fieldHash: res.fieldHash,
      };
    });
  }

  processQuery<T>(query: Query<T> | Query<T>[]) {
    return JSON.stringify(query);
  }

  findOne<T>(schemaName: string, query: Query<T>, options?: FindOneOptions): Promise<T> {
    const o = options ?? {};
    const populateArray = toPopulateArray(o.populate);
    return this.client!.findOne({
      schemaName,
      query: this.processQuery(query),
      ...o,
      select: o.select === null ? undefined : o.select,
      populate: populateArray,
    }).then(res => JSON.parse(res.result));
  }

  findMany<T>(
    schemaName: string,
    query: Query<T>,
    options?: FindManyOptions,
  ): Promise<T[]> {
    const o: FindManyOptions = { ...(options ?? {}) };
    if (typeof o.sort === 'string') o.sort = [o.sort];
    const sortObj = Array.isArray(o.sort) ? this.constructSortObj(o.sort) : o.sort;
    const populateArray = toPopulateArray(o.populate);

    return this.client!.findMany({
      schemaName,
      query: this.processQuery(query),
      ...o,
      select: o.select === null ? undefined : o.select,
      sort: sortObj,
      populate: populateArray,
    }).then(res => JSON.parse(res.result));
  }

  create<T>(schemaName: string, query: Query<T>, options?: AuthzOptions): Promise<T> {
    return this.client!.create({
      schemaName,
      query: this.processQuery(query),
      ...(options ?? {}),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  createMany<T>(
    schemaName: string,
    query: Query<T>[],
    options?: AuthzOptions,
  ): Promise<T[] | UntypedArray> {
    return this.client!.createMany({
      schemaName,
      query: this.processQuery(query),
      ...(options ?? {}),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any> {
    const o = options ?? {};
    const populateArray = toPopulateArray(o.populate);
    return this.client!.findByIdAndUpdate({
      schemaName,
      id,
      query: this.processQuery(document),
      ...o,
      populate: populateArray,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  findByIdAndReplace<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any> {
    const o = options ?? {};
    const populateArray = toPopulateArray(o.populate);
    return this.client!.findByIdAndReplace({
      schemaName,
      id,
      query: this.processQuery(document),
      ...o,
      populate: populateArray,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  updateMany<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ) {
    const o = options ?? {};
    const populateArray = toPopulateArray(o.populate);
    return this.client!.updateMany({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      ...o,
      populate: populateArray,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  updateOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ) {
    const o = options ?? {};
    const populateArray = toPopulateArray(o.populate);
    return this.client!.updateOne({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      ...o,
      populate: populateArray,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  replaceOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ) {
    const o = options ?? {};
    const populateArray = toPopulateArray(o.populate);
    return this.client!.replaceOne({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      ...o,
      populate: populateArray,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteOne<T>(schemaName: string, query: Query<T>, options?: AuthzOptions) {
    return this.client!.deleteOne({
      schemaName,
      query: this.processQuery(query),
      ...(options ?? {}),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteMany<T>(schemaName: string, query: Query<T>, options?: AuthzOptions) {
    return this.client!.deleteMany({
      schemaName,
      query: this.processQuery(query),
      ...(options ?? {}),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  countDocuments<T>(
    schemaName: string,
    query: Query<T>,
    options?: CountDocumentsOptions,
  ): Promise<number> {
    return this.client!.countDocuments({
      schemaName,
      query: this.processQuery(query),
      ...(options ?? {}),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  rawQuery(schemaName: string, query: RawQuery) {
    const processed: any = query;
    if (query.mongoQuery) {
      for (const key of Object.keys(query.mongoQuery)) {
        processed.mongoQuery[key] = JSON.stringify(processed.mongoQuery[key]);
      }
    }
    if (query.sqlQuery?.options) {
      processed.sqlQuery.options = JSON.stringify(query.sqlQuery.options);
    }
    return this.client!.rawQuery({ schemaName, query: processed }).then(res => {
      return JSON.parse(res.result);
    });
  }

  createView(
    schemaName: string,
    viewName: string,
    joinedSchemas: string[],
    query: { mongoQuery?: Indexable; sqlQuery?: string },
  ) {
    const processed: any = query;
    if (query.mongoQuery) {
      processed.mongoQuery = JSON.stringify(query.mongoQuery);
    }
    return this.client!.createView({
      schemaName,
      viewName,
      joinedSchemas,
      query: processed,
    });
  }

  deleteView(viewName: string) {
    return this.client!.deleteView({ viewName });
  }

  columnExistence(schemaName: string, columns: string[]) {
    return this.client!.columnExistence({ schemaName, columns }).then(r => r.result);
  }

  migrate(schemaName: string) {
    return this.client!.migrate({ schemaName });
  }

  getDatabaseType() {
    return this.client!.getDatabaseType({});
  }

  generateId(): Promise<string> {
    return this.client!.generateId({}).then(res => res.result);
  }

  private constructSortObj(sort: string[]) {
    const sortObj: { [field: string]: -1 | 1 } = {};
    sort.forEach((sortVal: string) => {
      sortVal = sortVal.trim();
      if (sortVal.indexOf('-') !== -1) {
        sortObj[sortVal.substring(1)] = -1;
      } else {
        sortObj[sortVal] = 1;
      }
    });
    return sortObj;
  }
}
