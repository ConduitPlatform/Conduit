import {createStorageProvider, IStorageProvider} from '@conduit/storage-provider';
import File from './models/File';
import StorageConfigSchema from './config';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {grpcModule} from '@conduit/grpc-sdk';
import * as grpc from "grpc";
import * as path from 'path';
import {FileHandlers} from './handlers/file';
import {FileRoutes} from "./routes/file";

let protoLoader = require('@grpc/proto-loader');

export class StorageModule {
    private storageProvider: IStorageProvider;
    private isRunning: boolean = false;
    private readonly _url: string;
    private _fileHandlers: FileHandlers;
    private grpcServer: any;
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
        this.grpcServer = new grpcModule.Server();

        this.grpcServer.addService(storage.service, {
            setConfig: this.setConfig.bind(this),
            getFile: this.getFileGrpc.bind(this),
            createFile: this.createFileGrpc.bind(this)
        });
        let files = new FileRoutes(this.grpcServer, grpcSdk, this.storageProvider);
        this._routes = files.registeredRoutes;
        this._url = process.env.SERVICE_URL || '0.0.0.0:0';
        let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
        this._url = process.env.SERVICE_URL || ('0.0.0.0:' + result);
        console.log("bound on:", this._url);
        this.grpcServer.start();
        this.grpcSdk.waitForExistence('database-provider')
            .then(() => {
                return this.grpcSdk.config.get('storage')
            })
            .catch(() => {
                return this.grpcSdk.config.updateConfig(StorageConfigSchema.getProperties(), 'storage');
            })
            .then((storageConfig: any) => {
                if (storageConfig.active) {
                    return this.enableModule();
                }
            }).catch(console.log);
    }

    get routes() {
        return this._routes;
    }

    get url() {
        return this._url;
    }

    async setConfig(call: any, callback: any) {

        const newConfig = JSON.parse(call.request.newConfig);
        if (!StorageConfigSchema.load(newConfig).validate()) {
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
        const response = await this._fileHandlers.getFile(JSON.stringify({
            request: {
                params: {id},
                headers: {}
            }
        }), callback).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {fileDocument: JSON.stringify(response)});
    }

    async createFileGrpc(call: any, callback: any) {
        if (!this._fileHandlers) return callback({code: grpc.status.INTERNAL, message: 'File handlers not initiated'});

        const {name, mimeType, data, folder} = call.request;
        let errorMessage: string | null = null;
        const response = await this._fileHandlers.createFile(JSON.stringify({
            request: {
                params: {name, mimeType, data, folder},
                headers: {}
            }
        }), callback).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {fileDocument: JSON.stringify(response)});
    }

    private async enableModule(): Promise<any> {
        const storageConfig = await this.grpcSdk.config.get('storage');
        const {provider, storagePath, google} = storageConfig;

        if (!this.isRunning) {
            this.storageProvider = createStorageProvider(provider, {storagePath, google});
            this.registerModels();
            this.isRunning = true;
        } else {
            this.storageProvider = createStorageProvider(provider, {storagePath, google});
            this._fileHandlers.updateProvider(this.storageProvider);
        }
    }

    private registerModels(): any {
        return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(File);
    }
}
