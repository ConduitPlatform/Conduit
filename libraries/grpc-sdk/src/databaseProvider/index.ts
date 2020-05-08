import * as grpc from 'grpc';
import path from 'path';
import { promisify } from 'util';

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
    return promisify(this.client.getSchema(schemaName)).bind(this.client);
  }

  createSchemaFromAdapter(schema: any): Promise<any> {
      return promisify(this.client.createSchemaFromAdapter(schema)).bind(this.client);
  }
}
