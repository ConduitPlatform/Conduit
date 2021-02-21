import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';

export default class DatabaseProvider extends ConduitModule {
  constructor(url: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/database-provider.proto');
    this.descriptorObj = 'databaseprovider.DatabaseProvider';
    this.initializeClient();
  }

  getSchema(schemaName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.getSchema({ schemaName: schemaName }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res.schema);
        }
      });
    });
  }

  createSchemaFromAdapter(schema: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.createSchemaFromAdapter(
        {
          schema: {
            name: schema.name,
            modelSchema: JSON.stringify(schema.fields ?? schema.modelSchema),
            modelOptions: JSON.stringify(schema.modelOptions),
          },
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve({
              name: res.schema.name,
              modelSchema: JSON.parse(res.schema.modelSchema),
              modelOptions: JSON.parse(res.schema.modelOptions),
            });
          }
        }
      );
    });
  }

  findOne(schemaName: string, query: any, select?: any, populate?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const selectStr = select ? JSON.stringify(select) : null;
      const populateStr = populate ? JSON.stringify(populate) : null;
      this.client.findOne(
        {
          schemaName,
          query: JSON.stringify(query),
          select: selectStr,
          populate: populateStr,
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  findMany(
    schemaName: string,
    query: any,
    select?: any,
    skip?: number,
    limit?: number,
    sort?: any,
    populate?: any
  ) {
    return new Promise((resolve, reject) => {
      const selectStr = select ? JSON.stringify(select) : null;
      const sortStr = sort ? JSON.stringify(sort) : null;
      const populateStr = populate ? JSON.stringify(populate) : null;
      this.client.findMany(
        {
          schemaName,
          query: JSON.stringify(query),
          select: selectStr,
          skip,
          limit,
          sort: sortStr,
          populate: populateStr,
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  create(schemaName: string, query: any) {
    return new Promise((resolve, reject) => {
      this.client.create(
        { schemaName, query: JSON.stringify(query) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  createMany(schemaName: string, query: any) {
    return new Promise((resolve, reject) => {
      this.client.createMany(
        { schemaName, query: JSON.stringify(query) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  findByIdAndUpdate(schemaName: string, id: any, document: any) {
    return new Promise((resolve, reject) => {
      this.client.findByIdAndUpdate(
        { schemaName, id, query: JSON.stringify(document) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  updateMany(schemaName: string, filterQuery: any, query: any) {
    return new Promise((resolve, reject) => {
      this.client.updateMany(
        {
          schemaName,
          filterQuery: JSON.stringify(filterQuery),
          query: JSON.stringify(query),
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  deleteOne(schemaName: string, query: any) {
    return new Promise((resolve, reject) => {
      this.client.deleteOne(
        { schemaName, query: JSON.stringify(query) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  deleteMany(schemaName: string, query: any) {
    return new Promise((resolve, reject) => {
      this.client.deleteMany(
        { schemaName, query: JSON.stringify(query) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }

  countDocuments(schemaName: string, query: any) {
    return new Promise((resolve, reject) => {
      this.client.countDocuments(
        { schemaName, query: JSON.stringify(query) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.result));
          }
        }
      );
    });
  }
}
