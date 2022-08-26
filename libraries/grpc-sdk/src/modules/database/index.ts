import { ConduitModule } from '../../classes/ConduitModule';
import { ConduitSchema, ConduitSchemaExtension } from '../../classes';
import {
  DatabaseProviderDefinition,
  DropCollectionResponse,
  Schema,
} from '../../protoUtils/database';
import { Query } from '../../interfaces';

export class DatabaseProvider extends ConduitModule<typeof DatabaseProviderDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'database', url, grpcToken);
    this.initializeClient(DatabaseProviderDefinition);
  }

  getSchema(
    schemaName: string,
  ): Promise<{ name: string; modelSchema: any; modelOptions: any }> {
    return this.client!.getSchema({ schemaName: schemaName }).then(res => {
      return {
        name: res.name,
        modelSchema: JSON.parse(res.fields),
        modelOptions: JSON.parse(res.options),
      };
    });
  }

  getSchemas(): Promise<{ name: string; modelSchema: any; modelOptions: any }[]> {
    return this.client!.getSchemas({}).then(res => {
      return res.schemas.map(
        (schema: { name: string; fields: string; options: string }) => {
          return {
            name: schema.name,
            modelSchema: JSON.parse(schema.fields),
            modelOptions: JSON.parse(schema.options),
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
      options: JSON.stringify(schema.options),
      collectionName: schema.collectionName,
    }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        options: JSON.parse(res.options),
        collectionName: res.collectionName,
      };
    });
  }

  setSchemaExtension(extension: ConduitSchemaExtension): Promise<Schema> {
    return this.client!.setSchemaExtension({
      extension: {
        name: extension.name,
        fields: JSON.stringify(extension.fields ?? extension.modelSchema),
      },
    }).then(res => {
      return {
        name: res.name,
        fields: JSON.parse(res.fields),
        options: JSON.parse(res.options),
        collectionName: res.collectionName,
      };
    });
  }

  processQuery(query: Query) {
    return JSON.stringify(query);
  }

  findOne<T>(
    schemaName: string,
    query: Query,
    select?: string,
    populate?: string | string[],
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
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  constructSortObj(sort: string[]) {
    const sortObj: Query = {};
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
    query: Query,
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
    return this.client!.findMany({
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

  create<T>(schemaName: string, query: Query): Promise<T> {
    return this.client!.create({ schemaName, query: this.processQuery(query) }).then(
      res => {
        return JSON.parse(res.result);
      },
    );
  }

  createMany<T>(schemaName: string, query: Query): Promise<T[] | any[]> {
    return this.client!.createMany({ schemaName, query: this.processQuery(query) }).then(
      res => {
        return JSON.parse(res.result);
      },
    );
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query,
    updateProvidedOnly: boolean = false,
    populate?: string | string[],
  ): Promise<T | any> {
    let populateArray = populate;
    if (populate && !Array.isArray(populate)) {
      populateArray = [populate];
    }
    return this.client!.findByIdAndUpdate({
      schemaName,
      id,
      query: this.processQuery(document),
      updateProvidedOnly,
      populate: (populateArray as string[]) ?? [],
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  updateMany(
    schemaName: string,
    filterQuery: Query,
    query: Query,
    updateProvidedOnly: boolean = false,
  ) {
    return this.client!.updateMany({
      schemaName,
      filterQuery: this.processQuery(filterQuery),
      query: this.processQuery(query),
      updateProvidedOnly,
    }).then(res => {
      return JSON.parse(res.result);
    });
  }

  deleteOne(schemaName: string, query: Query) {
    return this.client!.deleteOne({ schemaName, query: this.processQuery(query) }).then(
      res => {
        return JSON.parse(res.result);
      },
    );
  }

  deleteMany(schemaName: string, query: Query) {
    return this.client!.deleteMany({ schemaName, query: this.processQuery(query) }).then(
      res => {
        return JSON.parse(res.result);
      },
    );
  }

  countDocuments(schemaName: string, query: Query): Promise<number> {
    return this.client!.countDocuments({
      schemaName,
      query: this.processQuery(query),
    }).then(res => {
      return JSON.parse(res.result);
    });
  }
}
