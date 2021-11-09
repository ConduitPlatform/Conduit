import {
  createStorageProvider,
  IStorageProvider,
} from '@quintessential-sft/storage-provider';
import StorageConfigSchema from './config';
import { isNil } from 'lodash';
import {
  ConduitServiceModule,
  GrpcServer,
  wrapCallbackFunctionForRouter,
  wrapCallObjectForRouter,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import * as path from 'path';
import { FileHandlers } from './handlers/file';
import { FileRoutes } from './routes/router';
import { AdminRoutes } from './admin/admin';
import { migrateFoldersToContainers } from './migrations/container.migrations';
import Container from './models/Container';
import File from './models/File';
import Folder from './models/Folder';
import { ConfigController } from './config/Config.controller';

export class StorageModule extends ConduitServiceModule {
  private storageProvider: IStorageProvider;
  private isRunning: boolean = false;
  private _fileHandlers: FileHandlers;

  private _routes: any[];

  get routes() {
    return this._routes;
  }

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './storage.proto'),
      'storage.Storage',
      {
        setConfig: this.setConfig.bind(this),
        getFile: this.getFileGrpc.bind(this),
        createFile: this.createFileGrpc.bind(this),
        updateFile: this.updateFileGrpc.bind(this),
        getFileData: this.getFileData.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');

    this.storageProvider = createStorageProvider('local', {} as any);
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
    new FileRoutes(this.grpcServer, this.grpcSdk, this._fileHandlers);
    new AdminRoutes(this.grpcServer, this.grpcSdk, this._fileHandlers);
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
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
    try {
      await this.grpcSdk.config.get('storage');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(
        StorageConfigSchema.getProperties(),
        'storage'
      );
    }
    let storageConfig = await this.grpcSdk.config.addFieldstoConfig(
      StorageConfigSchema.getProperties(),
      'storage'
    );
    if (storageConfig.active) await this.enableModule();
  }

  async setConfig(call: any, callback: any) {
    const newConfig = JSON.parse(call.request.newConfig);

    try {
      StorageConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'storage')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const storageConfig = await this.grpcSdk.config.get('storage');
    if (storageConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('storage', 'config-update');
    } else {
      return callback({
        code: status.FAILED_PRECONDITION,
        message: 'Module is not active',
      });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  async getFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFile(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  async getFileData(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFileData(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  async createFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.createFile(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  async updateFileGrpc(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });

    await this._fileHandlers.updateFile(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  private async enableModule(): Promise<any> {
    await this.updateConfig();
    const storageConfig = ConfigController.getInstance().config;
    const { provider, storagePath, google, azure } = storageConfig;

    if (!this.isRunning) {
      await this.registerModels();
      await migrateFoldersToContainers(this.grpcSdk);
      this.isRunning = true;
    }
    this.storageProvider = createStorageProvider(provider, {
      storagePath,
      google,
      azure,
    });
    this._fileHandlers.updateProvider(this.storageProvider);
  }

  private async registerModels() {
    await this.grpcSdk.databaseProvider!.createSchemaFromAdapter(Container);
    await this.grpcSdk.databaseProvider!.createSchemaFromAdapter(File);
    await this.grpcSdk.databaseProvider!.createSchemaFromAdapter(Folder);
  }

  private async updateConfig(config?: any) {
    if (config) {
      ConfigController.getInstance().config = config;
      return Promise.resolve();
    } else {
      return this.grpcSdk.config.get('storage').then((config: any) => {
        ConfigController.getInstance().config = config;
      });
    }
  }
}
