import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';
import { EJSON } from 'bson';
import parse = EJSON.parse;
import serialize = EJSON.serialize;
import stringify = EJSON.stringify;

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

  processQuery(query: any) {
    if (typeof query === 'string') {
      query = JSON.parse(query);
    }
    return JSON.stringify(query);
  }

  findOne(
    schemaName: string,
    query: any,
    select?: string,
    populate?: string | string[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let populateArray = populate;
      if (populate && !Array.isArray(populate)) {
        populateArray = [populate];
      }
      this.client.findOne(
        {
          schemaName,
          query: this.processQuery(query),
          select,
          populate: populateArray,
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
    select?: string,
    skip?: number,
    limit?: number,
    sort?: any,
    populate?: string | string[]
  ) {
    return new Promise((resolve, reject) => {
      const sortStr = sort ? JSON.stringify(sort) : null;
      let populateArray = populate;
      if (populate && !Array.isArray(populate)) {
        populateArray = [populate];
      }
      this.client.findMany(
        {
          schemaName,
          query: this.processQuery(query),
          select,
          skip,
          limit,
          sort: sortStr,
          populate: populateArray,
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
        { schemaName, query: this.processQuery(query) },
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
        { schemaName, query: this.processQuery(query) },
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

  findByIdAndUpdate(schemaName: string, id: string, document: any) {
    return new Promise((resolve, reject) => {
      this.client.findByIdAndUpdate(
        { schemaName, id, query: this.processQuery(document) },
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
          filterQuery: this.processQuery(filterQuery),
          query: this.processQuery(query),
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
        { schemaName, query: this.processQuery(query) },
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
        { schemaName, query: this.processQuery(query) },
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
        { schemaName, query: this.processQuery(query) },
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
