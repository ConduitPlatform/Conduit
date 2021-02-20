import {createStorageProvider, IStorageProvider} from '@quintessential-sft/storage-provider';
import File from './models/File';
import StorageConfigSchema from './config';
import {isNil} from 'lodash';
import ConduitGrpcSdk, {addServiceToServer, createServer} from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from "grpc";
import * as path from 'path';
import {FileHandlers} from './handlers/file';
import {FileRoutes} from "./routes/router";

export class StorageModule {
    private storageProvider: IStorageProvider;
    private isRunning: boolean = false;
    private readonly _url: string;
    private _fileHandlers: FileHandlers;
    private grpcServer: any;
    private _routes: any[];

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {

        this._url = process.env.SERVICE_URL || "0.0.0.0:0";
        let serverResult = createServer(this._url);
        this.grpcServer = serverResult.server;
        this._url = process.env.SERVICE_URL || "0.0.0.0:" + serverResult.port;
        console.log("bound on:", this._url);

        addServiceToServer(this.grpcServer, path.resolve(__dirname, "./storage.proto"), "storage.Storage", {
            setConfig: this.setConfig.bind(this),
            getFile: this.getFileGrpc.bind(this),
            createFile: this.createFileGrpc.bind(this),
            updateFileGrpc: this.updateFileGrpc.bind(this)
        })

        let files = new FileRoutes(this.grpcServer, grpcSdk, this.storageProvider);
        this._routes = files.registeredRoutes;
        this.grpcServer.start();

        this.grpcSdk.waitForExistence('database-provider')
        .then(() => {
            return this.grpcSdk.initializeEventBus();
          })
          .then(() => {
            this.grpcSdk.bus?.subscribe("storage", (message: string) => {
              if (message === "config-update") {
                this.enableModule()
                  .then(() => {
                    console.log("Updated storage configuration");
                  })
                  .catch(() => {
                    console.log("Failed to update email config");
                  });
              }
            });
          })
          .catch(() => {
            console.log("Bus did not initialize!");
          })
            .then(() => {
                return this.grpcSdk.config.get('storage')
            })
            .catch(() => {
                return this.grpcSdk.config.updateConfig(StorageConfigSchema.getProperties(), 'storage');
            })
            .then(() => {
                return this.grpcSdk.config.addFieldstoConfig(StorageConfigSchema.getProperties(), 'storage');
            })
            .catch(() => {
                console.log('storage config did not update');
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
            if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
            this.grpcSdk.bus?.publish("storage", "config-update");
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

        const {name, mimeType, data, folder, isPublic} = call.request;
        let errorMessage: string | null = null;
        const response = await this._fileHandlers.createFile(JSON.stringify({
            request: {
                params: {name, mimeType, data, folder, isPublic},
                headers: {}
            }
        }), callback).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {fileDocument: JSON.stringify(response)});
    }

    async updateFileGrpc(call: any, callback: any) {
        if (!this._fileHandlers) return callback({code: grpc.status.INTERNAL, message: 'File handlers not initiated'});

        const {id, data, name, folder, mimeType} = call.request;
        let errorMessage: string | null = null;
        const response = await this._fileHandlers.updateFile(JSON.stringify({
            request: {
                params: {id, data, name, folder, mimeType},
                headers: {}
            }
        }), callback).catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        return callback(null, {fileDocument: JSON.stringify(response)});
    }

    private async enableModule(): Promise<any> {
        const storageConfig = await this.grpcSdk.config.get('storage');
        const {provider, storagePath, google, azure} = storageConfig;

        if (!this.isRunning) {
            this.storageProvider = createStorageProvider(provider, {storagePath, google, azure});
            this.registerModels();
            this.isRunning = true;
        } else {
            this.storageProvider = createStorageProvider(provider, {storagePath, google, azure});
            this._fileHandlers.updateProvider(this.storageProvider);
        }
    }

    private registerModels(): any {
        return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(File);
    }
}
