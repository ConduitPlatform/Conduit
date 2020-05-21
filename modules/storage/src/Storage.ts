import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import File from './models/File';
import StorageConfigSchema from './config/storage';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import * as grpc from "grpc";
import * as path from 'path';
import {ConduitUtilities} from '@conduit/utilities';
import {FileHandlers} from './handlers/file';
import {FileRoutes} from "./routes/file";

let protoLoader = require('@grpc/proto-loader');

export class StorageModule {
    private storageProvider: IStorageProvider;
    private isRunning: boolean = false;
    private readonly _url: string;
    private _fileHandlers: FileHandlers;
    private _routes: any[];

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        var packageDefinition = protoLoader.loadSync(
            path.resolve(__dirname, './storage.proto'),
            {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
        var protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

        var storage = protoDescriptor.storage.Storage;
        var server = new grpcModule.Server();

        server.addService(storage.service, {
            setConfig: this.setConfig.bind(this),
            getFile: this.getFileGrpc.bind(this),
            createFile: this.createFileGrpc.bind(this)
        });
        let files = new FileRoutes(server, grpcSdk, this.storageProvider);
        this._routes = files.registeredRoutes;
        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = server.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
        console.log("bound on:", this._url);
        server.start();
        this.ensureDatabase().then(() => {
            this.grpcSdk.config.get('storage').then((storageConfig: any) => {
                 if (storageConfig.active) {
                  return this.enableModule();
                 }
            })
        }).catch(console.log);
    }

    get routes() {
        return this._routes;
    }

    get url() {
        return this._url;
    }

    static get config() {
        return StorageConfigSchema;
    }

    async setConfig(call: any, callback: any) {

        const newConfig = JSON.parse(call.request.newConfig);
        if (!ConduitUtilities.validateConfigFields(newConfig, StorageConfigSchema.storage)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid configuration values'});
        }

        let errorMessage: string | null = null;
        const updateResult = await this.grpcSdk.config.updateConfig(newConfig, 'storage').catch((e: Error) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        const storageConfig = await this.grpcSdk.config.get('storage');
        if (storageConfig.active) {
            await this.enableModule().catch((e: Error) => errorMessage = e.message);
        } else {
            return callback({code: grpc.status.FAILED_PRECONDITION, message: 'Module is not active'});
        }
        if (!isNil(errorMessage)) {
            return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        return callback(null, {updatedConfig: JSON.stringify(updateResult)});
    }

    async getFileGrpc(call: any, callback: any) {
        if (!this._fileHandlers) return callback({code: grpc.status.INTERNAL, message: 'File handlers not initiated'});

        const id = call.request.id;
        let errorMessage: string | null = null;
        const response = await this._fileHandlers.getFile({
            params: {id},
            headers: {}
        }).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {fileDocument: JSON.stringify(response)});
    }

    async createFileGrpc(call: any, callback: any) {
        if (!this._fileHandlers) return callback({code: grpc.status.INTERNAL, message: 'File handlers not initiated'});

        const {name, mimeType, data, folder} = call.request;
        let errorMessage: string | null = null;
        const response = await this._fileHandlers.createFile({
            params: {name, mimeType, data, folder},
            headers: {}
        }).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {fileDocument: JSON.stringify(response)});
    }

    private async enableModule(): Promise<any> {
        const storageConfig = await this.grpcSdk.config.get('storage');
        const { provider, storagePath, google } = storageConfig;

        if (!this.isRunning) {
            this.storageProvider = createStorageProvider(provider, {storagePath, google});
            this.registerModels();
            this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
            this.isRunning = true;
        } else {
            this.storageProvider = createStorageProvider(provider, {storagePath, google});
            this._fileHandlers.updateProvider(this.storageProvider);
        }
    }

    private registerModels(): any {
        const database = this.grpcSdk.databaseProvider;
        if (isNil(database)) {
            return this.registerModels();
        }
        return database.createSchemaFromAdapter(File);
    }

    private async ensureDatabase(): Promise<any> {
        if (!this.grpcSdk.databaseProvider) {
            await this.grpcSdk.refreshModules(true);
            return this.ensureDatabase();
        }
    }
}
