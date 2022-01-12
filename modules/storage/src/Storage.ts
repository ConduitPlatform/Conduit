import StorageConfigSchema from './config';
import { isNil } from 'lodash';
import {
  ConduitServiceModule,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import * as path from 'path';
import { FileHandlers } from './handlers/file';
import { StorageRoutes } from './routes/routes';
import { AdminRoutes } from './admin/admin';
import { migrateFoldersToContainers } from './migrations/container.migrations';
import * as models from './models';
import { ConfigController } from './config/Config.controller';
import { createStorageProvider, IStorageProvider } from './storage-provider';

export class StorageModule extends ConduitServiceModule {
  private storageProvider: IStorageProvider;
  private _fileHandlers: FileHandlers;
  private _routes: any[];
  private isRunning: boolean = false;

  get routes() {
    return this._routes;
  }

  async initialize(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './storage.proto'),
      'storage.Storage',
      {
        setConfig: this.setConfig.bind(this),
        getFile: this.getFile.bind(this),
        createFile: this.createFile.bind(this),
        updateFile: this.updateFile.bind(this),
        getFileData: this.getFileData.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');

    this.storageProvider = createStorageProvider('local', {} as any);
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus?.subscribe('storage', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then((r) => {
            console.log('Updated storage configuration');
          })
          .catch((e: Error) => {
            console.log('Failed to update storage config');
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

  async getFile(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFile(call);
  }

  async getFileData(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.getFileData(call);
  }

  async createFile(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.createFile(call);
  }

  async updateFile(call: any, callback: any) {
    if (!this._fileHandlers)
      return callback({
        code: status.INTERNAL,
        message: 'File handlers not initiated',
      });
    await this._fileHandlers.updateFile(call);
  }

  private async enableModule(): Promise<any> {
    await this.updateConfig();
    const storageConfig = ConfigController.getInstance().config;
    const { provider, local, google, azure } = storageConfig;

    if (!this.isRunning) {
      await this.registerSchemas();
      await migrateFoldersToContainers(this.grpcSdk);
      this.isRunning = true;
    }
    this.storageProvider = createStorageProvider(provider, {
      local,
      google,
      azure,
    });
    this._fileHandlers = new FileHandlers(this.grpcSdk, this.storageProvider);
    const router = new StorageRoutes(this.grpcServer, this.grpcSdk, this._fileHandlers);
    new AdminRoutes(this.grpcServer, this.grpcSdk, this._fileHandlers);
    this._fileHandlers.updateProvider(this.storageProvider);
    await router.registerRoutes();
    this._routes = await router.getRegisteredRoutes();
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.grpcSdk.databaseProvider!);
      return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
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
