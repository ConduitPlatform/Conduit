import * as models from './models';
import { AdminRoutes } from './admin/admin';
import CustomModuleConfigSchema from './config';
import { isNil } from 'lodash';
import {
  ConduitServiceModule,
  DatabaseProvider,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import { CustomModuleRoutes } from './routes/routes';
import { ConfigController } from './config/Config.controller';
import { status } from '@grpc/grpc-js';

export default class CustomModule extends ConduitServiceModule {
  private _database: DatabaseProvider | undefined;
  private _admin: AdminRoutes | undefined;
  private _router: CustomModuleRoutes | undefined;
  private isRunning: boolean = false;

  async initialize(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './custom-module.proto'),
      'custommodule.CustomModule',
      {
        // NOTICE:
        // Register your gRPC functions here
        setConfig: this.setConfig.bind(this),
        // ... more
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus!.subscribe('custom-module', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated CustomModule configuration');
          })
          .catch(() => {
            console.log('Failed to update CustomModule config');
          });
      }
    });

    try {
      await this.grpcSdk.config.get('authentication');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(
        CustomModuleConfigSchema.getProperties(),
        'customModule'
      );
    }

    const config = await this.grpcSdk.config.addFieldstoConfig(
      CustomModuleConfigSchema.getProperties(),
      'customModule'
    );
    if (config.active) await this.enableModule();
  }

  private updateConfig(config?: any) {
    if (config) {
      ConfigController.getInstance().config = config;
      return Promise.resolve();
    } else {
      return this.grpcSdk.config.get('authentication').then((config: any) => {
        ConfigController.getInstance().config = config;
      });
    }
  }

  private async enableModule() {
    await this.updateConfig();
    if (!this.isRunning) {
      this._database = this.grpcSdk.databaseProvider!;
      await this.registerSchemas();
      this._admin = new AdminRoutes(this.grpcServer, this.grpcSdk);
      this._router = new CustomModuleRoutes(this.grpcServer, this.grpcSdk);
      this.isRunning = true;
    }
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      let modelInstance = model.getInstance(this.grpcSdk.databaseProvider!);
      if (Object.keys(modelInstance.fields).length !== 0) { // borrowed foreign model
        return this._database!.createSchemaFromAdapter(modelInstance);
      }
    });
    return Promise.all(promises);
  }

  // gRPC
  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    try {
      CustomModuleConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration values',
      });
    }

    let errorMessage: string | null = null;
    const customModuleConfig = await this.grpcSdk.config
      .updateConfig(newConfig, 'customModule')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    if (customModuleConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('customModule', 'config-update');
    } else {
      await this.updateConfig(customModuleConfig).catch(() => {
        console.log('Failed to update config');
      });
      this.grpcSdk.bus?.publish('customModule', 'config-update');
    }

    return callback(null, { updatedConfig: JSON.stringify(customModuleConfig) });
  }
}
