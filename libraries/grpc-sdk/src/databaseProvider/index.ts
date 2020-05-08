import * as grpc from 'grpc';
import path from 'path';

let protoLoader = require('@grpc/proto-loader');

export default class DatabaseProvider {
  private readonly client: any;

  constructor(url: string) {
    let packageDefinition = protoLoader.loadSync(path.resolve(__dirname, '../proto/database-provider.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const dbProvider = protoDescriptor.databaseprovider.DatabaseProvider;
    this.client = new dbProvider(url, grpc.credentials.createInsecure());
  }

  getSchema(schemaName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.getSchema(schemaName,
        (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
       })
    });
  }

  createSchemaFromAdapter(schema: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.createSchemaFromAdapter(schema, (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      })
    });
  }
}
