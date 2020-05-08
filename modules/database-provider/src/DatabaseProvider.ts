import {MongooseAdapter} from "./adapters/mongoose-adapter";
import {DatabaseAdapter} from './interfaces';
import ConduitGrpcSdk, { grpcModule } from '@conduit/grpc-sdk';
import * as grpc from "grpc";

let protoLoader = require('@grpc/proto-loader');

export class DatabaseProvider {

  private readonly _activeAdapter: DatabaseAdapter;
  private _url: string;

  constructor(private readonly conduit: ConduitGrpcSdk) {
    const dbType = process.env.databaseType ? process.env.databaseType : 'mongodb';
    const databaseUrl = process.env.databaseURL ?
      process.env.databaseURL : 'mongodb://localhost:27017/?readPreference=primary&appname=MongoDB%20Compass&ssl=false';

    if (dbType === 'mongodb') {
      this._activeAdapter = new MongooseAdapter(databaseUrl);
    } else {
      throw new Error("Arguments not supported")
    }

    let packageDefinition = protoLoader.loadSync(
      './database-provider.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
    let protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

    let databaseProvider = protoDescriptor.databaseprovider.DatabaseProvider;
    let server = new grpcModule.Server();

    server.addService(databaseProvider.service, {
      createSchemaFromAdapter: this.createSchemaFromAdapter.bind(this),
      getSchema: this.getSchema.bind(this)
    });
    this._url = process.env.SERVICE_URL || '0.0.0.0:0';
    let result = server.bind(this._url, grpcModule.ServerCredentials.createInsecure());
    this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
    console.log("bound on:", this._url);
    server.start();
  }

  get url() {
    return this._url;
  }

  /**
   * Should accept a JSON schema and output a .ts interface for the adapter
   * @param call
   * @param callback
   */
  createSchemaFromAdapter(call: any, callback: any) {
    this._activeAdapter.createSchemaFromAdapter(call.request.schema)
      .then(schemaAdapter => {
        callback(null, schemaAdapter);
      })
      .catch(err => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.messages,
        });
      });
  }

  /**
   * Given a schema name, returns the schema adapter assigned
   * @param call
   * @param callback
   */
  getSchema(call: any, callback: any) {
    this._activeAdapter.getSchema(call.request.schemaName)
      .then(schemaAdapter => {
        callback(null, schemaAdapter);
      })
      .catch(err => {
        callback({
          code: grpc.status.INTERNAL,
          message: err.messages,
        });
      });
  }
}

