import {MongooseAdapter} from "./adapters/mongoose-adapter";
import {DatabaseAdapter} from './interfaces';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import * as grpc from "grpc";
import path from "path";

let protoLoader = require('@grpc/proto-loader');

export class DatabaseProvider {

    private readonly _activeAdapter: DatabaseAdapter;
    private _url: string;

    constructor(private readonly conduit: ConduitGrpcSdk) {
        const dbType = process.env.databaseType ? process.env.databaseType : 'mongodb';
        const databaseUrl = process.env.databaseURL ?
            process.env.databaseURL : 'mongodb://localhost:27017';

        if (dbType === 'mongodb') {
            this._activeAdapter = new MongooseAdapter(databaseUrl);
        } else {
            throw new Error("Arguments not supported")
        }
        let protoPath = path.resolve(__dirname, './database-provider.proto');

        let packageDefinition = protoLoader.loadSync(
            protoPath,
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
            getSchema: this.getSchema.bind(this),
            findOne: this.findOne.bind(this),
            findMany: this.findMany.bind(this),
            create: this.create.bind(this),
            findByIdAndUpdate: this.findByIdAndUpdate.bind(this)
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
        let schema = {
            name: call.request.schema.name,
            modelSchema:JSON.parse(call.request.schema.modelSchema),
            modelOptions: JSON.parse(call.request.schema.modelOptions)
        }
        this._activeAdapter.createSchemaFromAdapter(schema)
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

    findOne(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
          .then((schemaAdapter: { model: any }) => {
              return schemaAdapter.model.findOne(JSON.parse(call.request.query), call.request.select ? JSON.parse(call.request.select) : null);
          })
          .then((doc: any) => {
              callback(null, { result: JSON.stringify(doc) });
          })
          .catch((err: any) => {
              callback({
                  code: grpc.status.INTERNAL,
                  message: err,
              });
          });
    }

    findMany(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
          .then((schemaAdapter: { model: any }) => {
              const skip = call.request.skip ? Number.parseInt(call.request.skip) : null;
              const limit = call.request.limit ? Number.parseInt(call.request.limit) : null;
              const select = call.request.select ? JSON.parse(call.request.select) : null;
              const sort = call.request.sort ? JSON.parse(call.request.sort) : null;

              return schemaAdapter.model.findMany(JSON.parse(call.request.query), skip, limit, select, sort);
          })
          .then((docs: any) => {
              callback(null, { result: JSON.stringify(docs) });
          })
          .catch((err: any) => {
              callback({
                  code: grpc.status.INTERNAL,
                  message: err,
              });
          });
    }

    create(call: any, callback: any) {
      this._activeAdapter.getSchemaModel(call.request.schemaName)
        .then((schemaAdapter: { model: any }) => {
          return schemaAdapter.model.create(JSON.parse(call.request.query));
        })
        .then(result => {
          callback(null, {result: JSON.stringify(result)});
        })
        .catch((err: any) => {
          callback({
            code: grpc.status.INTERNAL,
            message: err,
          });
        });
    }

    findByIdAndUpdate(call: any, callback: any) {
      this._activeAdapter.getSchemaModel(call.request.schemaName)
        .then((schemaAdapter: { model: any }) => {
          return schemaAdapter.model.findByIdAndUpdate(JSON.parse(call.request.document));
        })
        .then(result => {
          callback(null, {result: JSON.stringify(result)});
        })
        .catch((err: any) => {
          callback({
            code: grpc.status.INTERNAL,
            message: err,
          });
        });
    }
}
