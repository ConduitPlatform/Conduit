import * as grpc from 'grpc';
import path from 'path';
import {promisify} from 'util';

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
            this.client.getSchema({schemaName: schemaName}, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.schema);
                }
            })
        });
    }

    createSchemaFromAdapter(schema: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.createSchemaFromAdapter({
                schema:{
                    name: schema.name,
                    modelSchema: JSON.stringify(schema.fields),
                    modelOptions: JSON.stringify(schema.modelOptions)
                }

            }, (err: any, res: any) => {
                if (err || !res) {
                    reject(err || 'Something went wrong');
                } else {
                    resolve(res.schema);
                }
            })
        });
    }

    findOne(schemaName: string, query: string, select?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            this.client.findOne({ schemaName, query, select },
              (err: any, res: any) => {
                  if (err || !res) {
                      reject(err || 'Something went wrong');
                  } else {
                      resolve(res.result);
                  }
              })
        });
    }
}
