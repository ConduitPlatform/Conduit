import { ConduitModule } from '../../classes/ConduitModule';
import { ConduitSchema, ConduitSchemaExtension } from '../../classes';
import { DatabaseProviderDefinition, DropCollectionResponse } from '../../protoUtils/database-provider';

export class DatabaseProvider extends ConduitModule<typeof DatabaseProviderDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(DatabaseProviderDefinition);
  }

  getSchema(schemaName: string): Promise<{ name: string, modelSchema: any, modelOptions: any }> {
    return this.client!.getSchema({ schemaName: schemaName })
      .then((res) => {
        return {
          name: res.schema!.name,
          modelSchema: JSON.parse(res.schema!.modelSchema),
          modelOptions: JSON.parse(res.schema!.modelOptions),
        };
      });
  }

  getSchemas(): Promise<any> {
    return this.client!.getSchemas({})
      .then((res) => {
        return res.schemas.map(
          (schema: { name: string; modelSchema: string; modelOptions: string }) => {
            return {
              name: schema.name,
              modelSchema: JSON.parse(schema.modelSchema),
              modelOptions: JSON.parse(schema.modelOptions),
            };
          },
        );
      });
  }

  deleteSchema(schemaName: string, deleteData: boolean): Promise<DropCollectionResponse> {
    return this.client!.deleteSchema({ schemaName, deleteData });
  }

  createSchemaFromAdapter(schema: ConduitSchema): Promise<any> {
    return this.client!.createSchemaFromAdapter(
      {
        schema: {
          name: schema.name,
          modelSchema: JSON.stringify(schema.fields ?? schema.modelSchema),
          modelOptions: JSON.stringify(schema.schemaOptions),
          collectionName: schema.collectionName,
        },
      })
      .then(res => {
        return {
          name: res.schema!.name,
          modelSchema: JSON.parse(res.schema!.modelSchema),
          modelOptions: JSON.parse(res.schema!.modelOptions),
          collectionName: res.schema!.collectionName,
        };
      });
  }

  setSchemaExtension(extension: ConduitSchemaExtension): Promise<any> {
    return this.client!.setSchemaExtension(
      {
         extension: {
           name: extension.name,
           modelSchema: JSON.stringify(extension.fields ?? extension.modelSchema),
         },
      })
      .then(res => {
        return {
          name: res.schema!.name,
          modelSchema: JSON.parse(res.schema!.modelSchema),
          modelOptions: JSON.parse(res.schema!.modelOptions),
          collectionName: res.schema!.collectionName,
        };
      });
  }

  processQuery(query: { [key: string]: any }) {
    return JSON.stringify(query);
  }

  findOne<T>(
    schemaName: string,
    query: { [key: string]: any },
    select?: string,
    populate?: string | string[],
  ): Promise<T> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findOne(
      {
        schemaName,
        query: this.processQuery(query),
        select: select === null ? undefined : select,
        populate: (populateArray as string[]) ?? [],
      }).then(res => {
      return JSON.parse(res.result);
    });
  }

  constructSortObj(sort: string[]) {
    let sortObj: any = {};
    sort.forEach((sortVal: string) => {
      sortVal = sortVal.trim();
      if (sortVal.indexOf('-') !== -1) {
        sortObj[sortVal.substr(1)] = -1;
      } else {
        sortObj[sortVal] = 1;
      }
    });
    return sortObj;
  }

  findMany<T>(
    schemaName: string,
    query: { [key: string]: any },
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
    return this.client!.findMany(
      {
        schemaName,
        query: this.processQuery(query),
        select: select === null ? undefined : select,
        skip,
        limit,
        sort: sortStr,
        populate: (populateArray as string[]) ?? [],
      })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  create<T>(schemaName: string, query: { [key: string]: any }): Promise<T> {
    return this.client!.create(
      { schemaName, query: this.processQuery(query) })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  createMany<T>(schemaName: string, query: { [key: string]: any }): Promise<T[] | any[]> {
    return this.client!.createMany(
      { schemaName, query: this.processQuery(query) })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: { [key: string]: any },
    updateProvidedOnly: boolean = false,
    populate?: string | string[],
  ): Promise<T | any> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findByIdAndUpdate(
      {
        schemaName,
        id,
        query: this.processQuery(document),
        updateProvidedOnly,
        populate: (populateArray as string[]) ?? [],
      })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  updateMany(
    schemaName: string,
    filterQuery: { [key: string]: any },
    query: { [key: string]: any },
    updateProvidedOnly: boolean = false,
  ) {
    return this.client!.updateMany(
      {
        schemaName,
        filterQuery: this.processQuery(filterQuery),
        query: this.processQuery(query),
        updateProvidedOnly,
      })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  deleteOne(schemaName: string, query: { [key: string]: any }) {
    return this.client!.deleteOne(
      { schemaName, query: this.processQuery(query) })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  deleteMany(schemaName: string, query: { [key: string]: any }) {
    return this.client!.deleteMany(
      { schemaName, query: this.processQuery(query) })
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  countDocuments(schemaName: string, query: { [key: string]: any }): Promise<number> {
    return this.client!.countDocuments(
      { schemaName, query: this.processQuery(query) })
      .then(res => {
        return JSON.parse(res.result);
      });
  }
}
