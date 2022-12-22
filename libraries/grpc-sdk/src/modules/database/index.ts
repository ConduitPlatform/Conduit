import { ConduitModule } from '../../classes/ConduitModule';
import { ConduitSchema } from '../../classes';
import {
  DatabaseProviderDefinition,
  DropCollectionResponse,
  RegisterMigrationResponse,
  TriggerMigrationsResponse,
  Schema,
} from '../../protoUtils/database';
import { ConduitSchemaExtension, RawQuery } from '../../interfaces';
import { Query } from '../../types/db';

export class DatabaseProvider extends ConduitModule<typeof DatabaseProviderDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'database', url, grpcToken);
    this.initializeClients(DatabaseProviderDefinition);
  }

  getSchema(schemaName: string): Promise<{
    name: string;
    fields: any;
    modelOptions: any;
    fieldHash: string;
  }> {
    return this.serviceClient!.getSchema({ schemaName: schemaName }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.modelOptions),
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
    return this.serviceClient!.getSchemas({}).then(res => {
      return res.schemas.map(
        (schema: {
          name: string;
          fields: string;
          modelOptions: string;
          fieldHash: string;
        }) => {
          return {
            name: schema.name,
            fields: JSON.parse(schema.fields),
            modelOptions: JSON.parse(schema.modelOptions),
            fieldHash: schema.fieldHash,
          };
        },
      );
    });
  }

  deleteSchema(schemaName: string, deleteData: boolean): Promise<DropCollectionResponse> {
    return this.serviceClient!.deleteSchema({ schemaName, deleteData });
  }

  createSchemaFromAdapter(schema: ConduitSchema): Promise<Schema> {
    return this.serviceClient!.createSchemaFromAdapter({
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

  registerMigration(
    moduleName: string,
    migrationName: string,
    data: string,
  ): Promise<RegisterMigrationResponse> {
    return this.serviceClient!.registerMigration({
      moduleName: moduleName,
      migrationName: migrationName,
      data: data,
    });
  }

  triggerMigrations(moduleName: string): Promise<TriggerMigrationsResponse> {
    return this.serviceClient!.triggerMigrations({ moduleName });
  }

  setSchemaExtension(extension: ConduitSchemaExtension): Promise<Schema> {
    return this.serviceClient!.setSchemaExtension({
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
  ): Promise<T> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.serviceClient!.findOne({
      schemaName,
      query: this.processQuery(query),
      select: select === null ? undefined : select,
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  constructSortObj(sort: string[]) {
    const sortObj: { [key: string]: number } = {};
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

  findMany<T>(
    schemaName: string,
    query: Query<T>,
    select?: string,
    skip?: number,
    limit?: number,
    sort?: { [key: string]: number } | string[],
    populate?: string | string[],
  ): Promise<T[]> {
    let sortStr;
    if (Array.isArray(sort)) {
      sortStr = JSON.stringify(this.constructSortObj(sort));
    } else {
      sortStr = sort ? JSON.stringify(sort) : undefined;
    }

    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.serviceClient!.findMany({
      schemaName,
      query: this.processQuery(query),
      select: select === null ? undefined : select,
      skip,
      limit,
      sort: sortStr,
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  create<T>(schemaName: string, query: Query<T>): Promise<T> {
    return this.serviceClient!.create({
      schemaName,
      query: this.processQuery(query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  createMany<T>(schemaName: string, query: Query<T>): Promise<T[] | any[]> {
    return this.serviceClient!.createMany({
      schemaName,
      query: this.processQuery(query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    updateProvidedOnly: boolean = false,
    populate?: string | string[],
  ): Promise<T | any> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.serviceClient!.findByIdAndUpdate({
      schemaName,
      id,
      query: this.processQuery(document),
      updateProvidedOnly,
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  updateMany<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    updateProvidedOnly: boolean = false,
  ) {
    return this.serviceClient!.updateMany({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      updateProvidedOnly,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteOne<T>(schemaName: string, query: Query<T>) {
    return this.serviceClient!.deleteOne({
      schemaName,
      query: this.processQuery(query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteMany<T>(schemaName: string, query: Query<T>) {
    return this.serviceClient!.deleteMany({
      schemaName,
      query: this.processQuery(query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  countDocuments<T>(schemaName: string, query: Query<T>): Promise<number> {
    return this.serviceClient!.countDocuments({
      schemaName,
      query: this.processQuery(query),
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
    return this.serviceClient!.rawQuery({ schemaName, query: processed }).then(res => {
      return JSON.parse(res.result);
    });
  }

  getDatabaseType() {
    return this.serviceClient!.getDatabaseType({});
  }

  getSystemSchemas() {
    return this.serviceClient!.getSystemSchemas({});
  }
}
