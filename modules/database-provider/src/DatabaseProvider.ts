import {MongooseAdapter} from "./adapters/mongoose-adapter";
import {DatabaseAdapter, SchemaAdapter} from './interfaces';
import ConduitGrpcSdk, {grpcModule} from '@quintessential-sft/conduit-grpc-sdk';
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

    }

    ensureIsRunning() {
        return new Promise((resolve, reject) => {
            this._activeAdapter.ensureConnected().then(() => {
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
                    findByIdAndUpdate: this.findByIdAndUpdate.bind(this),
                    updateMany: this.updateMany.bind(this),
                    deleteOne: this.deleteOne.bind(this),
                    deleteMany: this.deleteMany.bind(this),
                    countDocuments: this.countDocuments.bind(this)
                });
                this._url = process.env.SERVICE_URL || '0.0.0.0:0';
                let result = server.bind(this._url, grpcModule.ServerCredentials.createInsecure());
                this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
                console.log("bound on:", this._url);
                server.start();
                resolve();
            }).catch(reject);
        });

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
            modelSchema: JSON.parse(call.request.schema.modelSchema),
            modelOptions: JSON.parse(call.request.schema.modelOptions)
        }
        this._activeAdapter.createSchemaFromAdapter(schema)
            .then((schemaAdapter: any) => {
                let schema = schemaAdapter.schema;
                callback(null, {
                    schema: {
                        name: schema.originalSchema.name,
                        modelSchema: JSON.stringify(schema.originalSchema.modelSchema),
                        modelOptions: JSON.stringify(schema.originalSchema.modelOptions)
                    }
                });
            })
            .catch(err => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
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
                callback(null, {
                    schema: {
                        name: schemaAdapter.schema.name,
                        modelSchema: JSON.stringify(schemaAdapter.schema.modelSchema),
                        modelOptions: JSON.stringify(schemaAdapter.schema.modelOptions)
                    }
                });
            })
            .catch(err => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }

    findOne(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
            .then((schemaAdapter: { model: any }) => {
                return schemaAdapter.model.findOne(JSON.parse(call.request.query), call.request.select ? JSON.parse(call.request.select) : null);
            })
            .then((doc: any) => {
                callback(null, {result: JSON.stringify(doc)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
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
                callback(null, {result: JSON.stringify(docs)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
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
                    message: err.message,
                });
            });
    }

    findByIdAndUpdate(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
            .then((schemaAdapter: { model: any }) => {
                return schemaAdapter.model.findByIdAndUpdate(call.request.id, JSON.parse(call.request.query));
            })
            .then(result => {
                callback(null, {result: JSON.stringify(result)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }

    updateMany(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
            .then((schemaAdapter: {model: any}) => {
                return schemaAdapter.model.updateMany(JSON.parse(call.request.filterQuery), JSON.parse(call.request.query));
            })
            .then(result => {
                callback(null, {result: JSON.stringify(result)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }

    deleteOne(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
            .then((schemaAdapter: { model: any }) => {
                return schemaAdapter.model.deleteOne(JSON.parse(call.request.query));
            })
            .then(result => {
                callback(null, {result: JSON.stringify(result)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }

    deleteMany(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
            .then((schemaAdapter: { model: any }) => {
                return schemaAdapter.model.deleteMany(JSON.parse(call.request.query));
            })
            .then(result => {
                callback(null, {result: JSON.stringify(result)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }

    countDocuments(call: any, callback: any) {
        this._activeAdapter.getSchemaModel(call.request.schemaName)
            .then((schemaAdapter: { model: any }) => {
                return schemaAdapter.model.countDocuments(JSON.parse(call.request.query));
            })
            .then(result => {
                callback(null, {result: JSON.stringify(result)});
            })
            .catch((err: any) => {
                callback({
                    code: grpc.status.INTERNAL,
                    message: err.message,
                });
            });
    }
}
