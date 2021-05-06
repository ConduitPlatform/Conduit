import {
  createStorageProvider,
  IStorageProvider,
} from '@quintessential-sft/storage-provider';
import File from './models/File';
import StorageConfigSchema from './config';
import { isNil } from 'lodash';
import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import * as grpc from 'grpc';
import * as path from 'path';
import { FileHandlers } from './handlers/file';
import { FileRoutes } from './routes/router';

let protoLoader = require('@grpc/proto-loader');

export class StorageModule {
  private storageProvider: IStorageProvider;
  private isRunning: boolean = false;
  private readonly _url: string;
  private _fileHandlers: FileHandlers;
  private grpcServer: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._url = this.grpcServer.url;
    this.grpcServer
      .addService(path.resolve(__dirname, './storage.proto'), 'storage.Storage', {
        setConfig: this.setConfig.bind(this),
        getFile: this.getFileGrpc.bind(this),
        createFile: this.createFileGrpc.bind(this),
        updateFile: this.updateFileGrpc.bind(this),
      })
      .then(() => {
        return this.grpcServer.start();
      })
      .then(() => {
        console.log('Grpc server is online');
      })
      .catch((err: Error) => {
        console.log('Failed to initialize server');
        console.error(err);
        process.exit(-1);
      });
    this.storageProvider = createStorageProvider('local', {} as any);
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
    new FileRoutes(this.grpcServer, this.grpcSdk, this.storageProvider);

    this.grpcSdk
      .waitForExistence('database-provider')
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        const self = this;
        this.grpcSdk.bus?.subscribe('storage', (message: string) => {
          if (message === 'config-update') {
            this.enableModule()
              .then((r) => {
                console.log('Updated storage configuration');
              })
              .catch((e: Error) => {
                console.log('Failed to update email config');
              });
          }
        });
      })
      .catch(() => {
        console.log('Bus did not initialize!');
      })
      .then(() => {
        return this.grpcSdk.config.get('storage');
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(
          StorageConfigSchema.getProperties(),
          'storage'
        );
      })
      .then((storageConfig: any) => {
        return this.grpcSdk.config.addFieldstoConfig(
          StorageConfigSchema.getProperties(),
          'storage'
        );
      })
      .catch(() => {
        console.log('storage config did not update');
      })
      .then((storageConfig: any) => {
        if (storageConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  private _routes: any[];

  get routes() {
    return this._routes;
  }

  get url() {
    return this._url;
  }

  async setConfig(call: any, callback: any) {
    const newConfig = JSON.parse(call.request.newConfig);

    try {
      StorageConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'storage')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const storageConfig = await this.grpcSdk.config.get('storage');
    if (storageConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('storage', 'config-update');
    } else {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'Module is not active',
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  async getFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: grpc.status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFile(call, callback);
  }

  async createFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: grpc.status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.createFile(call, callback);
  }

  async updateFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: grpc.status.INTERNAL,
        message: 'File handlers not initiated',
      });

    await this._fileHandlers.updateFile(call, callback);
  }

  private async enableModule(): Promise<any> {
    const storageConfig = await this.grpcSdk.config.get('storage');
    const { provider, storagePath, google, azure } = storageConfig;

    if (!this.isRunning) {
      this.registerModels();
      this.isRunning = true;
    }
    this.storageProvider = createStorageProvider(provider, {
      storagePath,
      google,
      azure,
    });
    this._fileHandlers.updateProvider(this.storageProvider);
  }

  private registerModels(): any {
    return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(File);
  }
}
