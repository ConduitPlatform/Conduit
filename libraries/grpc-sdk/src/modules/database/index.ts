import { ConduitModule } from '../../classes';
import {
  DatabaseProviderDefinition,
  DropCollectionResponse,
  Schema,
} from '../../protoUtils/database';
import { Indexable, RawQuery, UntypedArray } from '../../interfaces';
import { Query } from '../../types/db';
import { ConduitSchema } from '../../classes/ConduitSchema';
import { ConduitSchemaExtension } from '../../interfaces/ConduitSchemaExtension';

export class DatabaseProvider extends ConduitModule<typeof DatabaseProviderDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
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
  ): Promise<T> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findOne({
      schemaName,
      query: this.processQuery(query),
      select: select === null ? undefined : select,
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
    }).then(res => {
      return JSON.parse(res.result);
    });
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
  ): Promise<T[]> {
    if (typeof sort === 'string') sort = [sort];
    const sortObj = Array.isArray(sort) ? this.constructSortObj(sort) : sort;
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findMany({
      schemaName,
      query: this.processQuery(query),
      select: select === null ? undefined : select,
      skip,
      limit,
      sort: sortObj,
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  create<T>(
    schemaName: string,
    query: Query<T>,
    userId?: string,
    scope?: string,
  ): Promise<T> {
    return this.client!.create({
      schemaName,
      query: this.processQuery(query),
      userId,
      scope,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  createMany<T>(
    schemaName: string,
    query: Query<T>[],
    userId?: string,
    scope?: string,
  ): Promise<T[] | UntypedArray> {
    return this.client!.createMany({
      schemaName,
      query: this.processQuery(query),
      userId,
      scope,
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
  ): Promise<T | any> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findByIdAndUpdate({
      schemaName,
      id,
      query: this.processQuery(document),
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
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
  ): Promise<T | any> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findByIdAndReplace({
      schemaName,
      id,
      query: this.processQuery(document),
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
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
  ) {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.updateMany({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
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
  ) {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.updateOne({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
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
  ) {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.replaceOne({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      populate: (populateArray as string[]) ?? [],
      userId,
      scope,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteOne<T>(schemaName: string, query: Query<T>, userId?: string, scope?: string) {
    return this.client!.deleteOne({
      schemaName,
      query: this.processQuery(query),
      userId,
      scope,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteMany<T>(schemaName: string, query: Query<T>, userId?: string, scope?: string) {
    return this.client!.deleteMany({
      schemaName,
      query: this.processQuery(query),
      userId,
      scope,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  countDocuments<T>(
    schemaName: string,
    query: Query<T>,
    userId?: string,
    scope?: string,
  ): Promise<number> {
    return this.client!.countDocuments({
      schemaName,
      query: this.processQuery(query),
      userId,
      scope,
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
