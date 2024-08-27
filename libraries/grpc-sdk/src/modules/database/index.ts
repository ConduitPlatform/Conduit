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
import {
  FindOneParams,
  FindOneParamEnum,
  FindManyParams,
  FindManyParamEnum,
  CreateParams,
  CreateParamEnum,
  CreateManyParams,
  CreateManyParamEnum,
  FindByIdAndUpdateParams,
  FindByIdAndUpdateParamEnum,
  FindByIdAndReplaceParams,
  FindByIdAndReplaceEnum,
  UpdateManyParams,
  UpdateManyParamEnum,
  UpdateOneParams,
  UpdateOneParamEnum,
  ReplaceOneParams,
  ReplaceOneParamEnum,
  DeleteOneParams,
  DeleteOneParamEnum,
  DeleteManyParams,
  DeleteManyParamEnum,
  CountDocumentsParams,
  CountDocumentsParamEnum,
} from './types.js';
import { normalizeParams } from '../../utilities/normalizeParams';

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

  processQuery<T>(query: Query<T>) {
    return JSON.stringify(query);
  }

  findOne<T>(
    schemaName: string,
    query: Query<T>,
    select?: string,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T>;

  findOne<T>(params: {
    schemaName: string;
    query: Query<T>;
    select?: string;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<T>;

  findOne<T>(...params: FindOneParams<T>): Promise<T> {
    const obj = normalizeParams(params, Object.keys(FindOneParamEnum));
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;
    return this.client!.findOne({
      ...obj,
      query: this.processQuery(obj.query),
      select: obj.select === null ? undefined : obj.select,
      populate: (populateArray as string[]) ?? [],
    }).then(res => JSON.parse(res.result));
  }

  findMany<T>(
    schemaName: string,
    query: Query<T>,
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [field: string]: -1 | 1 } | string[] | string,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T[]>;

  findMany<T>(params: {
    schemaName: string;
    query: Query<T>;
    select?: string;
    skip?: number;
    limit?: number;
    sort?: { [field: string]: -1 | 1 } | string[] | string;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<T[]>;

  findMany<T>(...params: FindManyParams<T>): Promise<T[]> {
    const obj = normalizeParams(params, Object.keys(FindManyParamEnum));

    if (typeof obj.sort === 'string') obj.sort = [obj.sort];
    const sortObj = Array.isArray(obj.sort) ? this.constructSortObj(obj.sort) : obj.sort;
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;

    return this.client!.findMany({
      ...obj,
      query: this.processQuery(obj.query),
      select: obj.select === null ? undefined : obj.select,
      sort: sortObj,
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  create<T>(
    schemaName: string,
    query: Query<T>,
    userId?: string,
    scope?: string,
  ): Promise<T>;

  create<T>(params: {
    schemaName: string;
    query: Query<T>;
    userId?: string;
    scope?: string;
  }): Promise<T>;

  create<T>(...params: CreateParams<T>): Promise<T> {
    const obj = normalizeParams(params, Object.keys(CreateParamEnum));
    return this.client!.create({
      ...obj,
      query: this.processQuery(obj.query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  createMany<T>(
    schemaName: string,
    query: Query<T>[],
    userId?: string,
    scope?: string,
  ): Promise<T[] | UntypedArray>;

  createMany<T>(params: {
    schemaName: string;
    query: Query<T>[];
    userId?: string;
    scope?: string;
  }): Promise<T[] | UntypedArray>;

  createMany<T>(...params: CreateManyParams<T>): Promise<T[] | UntypedArray> {
    const obj = normalizeParams(params, Object.keys(CreateManyParamEnum));
    return this.client!.createMany({
      ...obj,
      query: this.processQuery(obj.query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T | any>;

  findByIdAndUpdate<T>(params: {
    schemaName: string;
    id: string;
    document: Query<T>;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<T | any>;

  findByIdAndUpdate<T>(...params: FindByIdAndUpdateParams<T>): Promise<T | any> {
    const obj = normalizeParams(params, Object.keys(FindByIdAndUpdateParamEnum));
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;
    return this.client!.findByIdAndUpdate({
      ...obj,
      query: this.processQuery(obj.document),
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  findByIdAndReplace<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<T | any>;

  findByIdAndReplace<T>(params: {
    schemaName: string;
    id: string;
    document: Query<T>;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<T | any>;

  findByIdAndReplace<T>(...params: FindByIdAndReplaceParams<T>): Promise<T | any> {
    const obj = normalizeParams(params, Object.keys(FindByIdAndReplaceEnum));
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;
    return this.client!.findByIdAndReplace({
      ...obj,
      query: this.processQuery(obj.document),
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  updateMany<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<any>;

  updateMany<T>(params: {
    schemaName: string;
    filterQuery: Query<T>;
    query: Query<T>;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<any>;

  updateMany<T>(...params: UpdateManyParams<T>) {
    const obj = normalizeParams(params, Object.keys(UpdateManyParamEnum));
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;
    return this.client!.updateMany({
      ...obj,
      filterQuery: this.processQuery(obj.filterQuery),
      query: this.processQuery(obj.query),
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  updateOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<any>;

  updateOne<T>(params: {
    schemaName: string;
    filterQuery: Query<T>;
    query: Query<T>;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<any>;

  updateOne<T>(...params: UpdateOneParams<T>) {
    const obj = normalizeParams(params, Object.keys(UpdateOneParamEnum));
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;
    return this.client!.updateOne({
      ...obj,
      filterQuery: this.processQuery(obj.filterQuery),
      query: this.processQuery(obj.query),
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  replaceOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    populate?: string | string[],
    userId?: string,
    scope?: string,
  ): Promise<any>;

  replaceOne<T>(params: {
    schemaName: string;
    filterQuery: Query<T>;
    query: Query<T>;
    populate?: string | string[];
    userId?: string;
    scope?: string;
  }): Promise<any>;

  replaceOne<T>(...params: ReplaceOneParams<T>) {
    const obj = normalizeParams(params, Object.keys(ReplaceOneParamEnum));
    const populateArray =
      obj.populate && !Array.isArray(obj.populate) ? [obj.populate] : obj.populate;
    return this.client!.replaceOne({
      ...obj,
      filterQuery: this.processQuery(obj.filterQuery),
      query: this.processQuery(obj.query),
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteOne<T>(
    schemaName: string,
    query: Query<T>,
    userId?: string,
    scope?: string,
  ): Promise<any>;

  deleteOne<T>(params: {
    schemaName: string;
    query: Query<T>;
    userId?: string;
    scope?: string;
  }): Promise<any>;

  deleteOne<T>(...params: DeleteOneParams<T>) {
    const obj = normalizeParams(params, Object.keys(DeleteOneParamEnum));
    return this.client!.deleteOne({
      ...obj,
      query: this.processQuery(obj.query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteMany<T>(
    schemaName: string,
    query: Query<T>,
    userId?: string,
    scope?: string,
  ): Promise<any>;

  deleteMany<T>(params: {
    schemaName: string;
    query: Query<T>;
    userId?: string;
    scope?: string;
  }): Promise<any>;

  deleteMany<T>(...params: DeleteManyParams<T>) {
    const obj = normalizeParams(params, Object.keys(DeleteManyParamEnum));
    return this.client!.deleteMany({
      ...obj,
      query: this.processQuery(obj.query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  countDocuments<T>(
    schemaName: string,
    query: Query<T>,
    userId?: string,
    scope?: string,
  ): Promise<number>;

  countDocuments<T>(params: {
    schemaName: string;
    query: Query<T>;
    userId?: string;
    scope?: string;
  }): Promise<number>;

  countDocuments<T>(...params: CountDocumentsParams<T>): Promise<number> {
    const obj = normalizeParams(params, Object.keys(CountDocumentsParamEnum));
    return this.client!.countDocuments({
      ...obj,
      query: this.processQuery(obj.query),
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
      processed.sqlQuery.options = JSON.stringify(processed.sqlQuery.options);
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
      processed.mongoQuery = JSON.stringify(processed.mongoQuery);
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
