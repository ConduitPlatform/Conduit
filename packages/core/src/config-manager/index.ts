import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  GrpcServer,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitCommons,
  GetConfigResponse,
  GetRedisDetailsResponse,
  IConfigManager,
  UpdateRequest,
  UpdateResponse,
} from '@conduitplatform/commons';
import { runMigrations } from './migrations';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import path from 'path';
import { ServiceDiscovery } from './service-discovery';
import { ConfigStorage } from './config-storage';

export default class ConfigManager implements IConfigManager {
  grpcSdk: ConduitGrpcSdk;
  private readonly serviceDiscovery: ServiceDiscovery;
  private _configStorage: ConfigStorage;

  constructor(grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitCommons) {
    this.grpcSdk = grpcSdk;
    this.serviceDiscovery = new ServiceDiscovery(grpcSdk, sdk);
    this._configStorage = new ConfigStorage(sdk, grpcSdk, this.serviceDiscovery);
  }

  getModuleUrlByName(moduleName: string): string | undefined {
    return this.serviceDiscovery.getModuleUrlByName(moduleName);
  }

  async initialize(server: GrpcServer) {
    await server.addService(
      path.resolve(__dirname, '../../src/core.proto'),
      'conduit.core.Config',
      {
        get: this.getGrpc.bind(this),
        getServerConfig: this.getServerConfig.bind(this),
        getRedisDetails: this.getRedisDetails.bind(this),
        updateConfig: this.updateConfig.bind(this),
        addFieldsToConfig: this.addFieldsToConfig.bind(this),
        configure: this.configureModule.bind(this),
        moduleExists: this.serviceDiscovery.moduleExists.bind(this.serviceDiscovery),
        registerModule: this.serviceDiscovery.registerModule.bind(this.serviceDiscovery),
        moduleList: this.serviceDiscovery.moduleList.bind(this.serviceDiscovery),
        watchModules: this.serviceDiscovery.watchModules.bind(this.serviceDiscovery),
        moduleHealthProbe: this.serviceDiscovery.moduleHealthProbe.bind(
          this.serviceDiscovery,
        ),
        getModuleUrlByName: this.serviceDiscovery.getModuleUrlByNameGrpc.bind(
          this.serviceDiscovery,
        ),
      },
    );
    await this.highAvailability();
    this.serviceDiscovery.beginMonitors();
  }

  async highAvailability() {
    const loadedState = await this.sdk.getState().getKey('config');
    try {
      if (!loadedState || loadedState.length === 0) return;
      const state = JSON.parse(loadedState);
      const success: {
        name: string;
        url: string;
        instance: string;
      }[] = [];
      if (state.modules) {
        for (const module of state.modules) {
          try {
            await this.serviceDiscovery._registerModule(
              module.name,
              module.url,
              module.instance,
            );
            success.push({
              name: module.name,
              url: module.url,
              instance: module.instance,
            });
          } catch {}
        }
        if (state.modules.length > success.length) {
          state.modules = success;
          this.setState(state);
        }
      } else {
        return Promise.resolve();
      }
    } catch {
      ConduitGrpcSdk.Logger.error('Failed to recover state');
    }
  }

  setState(state: any) {
    this.sdk
      .getState()
      .setKey('config', JSON.stringify(state))
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to recover state');
      });
  }

  getServerConfig(call: GrpcRequest<null>, callback: GrpcCallback<GetConfigResponse>) {
    this._configStorage
      .getConfig('core')
      .then(config => {
        callback(null, {
          data: JSON.stringify({
            url: ((config! as unknown) as { hostUrl: string }).hostUrl,
            env: ((config! as unknown) as { env: string })!.env,
          }),
        });
      })
      .catch(e => {
        return callback({
          code: status.NOT_FOUND,
          message: 'Server config not found!',
        });
      });
  }

  getRedisDetails(
    call: GrpcRequest<null>,
    callback: GrpcCallback<GetRedisDetailsResponse>,
  ) {
    callback(null, {
      redisHost: process.env.REDIS_HOST!,
      redisPort: parseInt(process.env.REDIS_PORT!),
    });
  }

  initConfigAdminRoutes() {
    this.registerAdminRoutes();
  }

  async registerAppConfig() {
    await this.grpcSdk.database!.createSchemaFromAdapter(
      models.Config.getInstance(this.grpcSdk.database!),
    );
    await runMigrations(this.grpcSdk);
    this._configStorage.onDatabaseAvailable();
  }

  getGrpc(call: GrpcRequest<{ key: string }>, callback: GrpcResponse<{ data: string }>) {
    this.get(call.request.key).then(r => {
      if (!r) {
        return callback({
          code: status.INTERNAL,
          message: 'Config for module not set!',
        });
      }
      callback(null, { data: JSON.stringify(r) });
    });
  }

  async get(moduleName: string) {
    return this._configStorage
      .getConfig(moduleName)
      .then(config => config)
      .catch(() => null);
  }

  async set(moduleName: string, moduleConfig: any) {
    try {
      await this._configStorage.setConfig(moduleName, JSON.stringify(moduleConfig));
      switch (moduleName) {
        case 'core':
          this.sdk.getCore().setConfig(moduleConfig);
          break;
        case 'admin':
          this.sdk.getAdmin().setConfig(moduleConfig);
          break;
        default:
          break;
      }
      return moduleConfig;
    } catch (e) {
      ConduitGrpcSdk.Logger.error(`Could not update "${moduleName}" configuration`);
    }
  }

  async updateConfig(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcCallback<UpdateResponse>,
  ) {
    const moduleName = call.request.moduleName;
    const moduleConfig = JSON.parse(call.request.config);
    try {
      await this.set(moduleName, moduleConfig);
      return callback(null, { result: JSON.stringify(moduleConfig) });
    } catch {
      callback({
        code: status.INTERNAL,
        message: `Could not update "${moduleName}" configuration`,
      });
      return;
    }
  }

  async registerModulesConfig(moduleName: string, moduleConfig: any) {
    return this.set(moduleName, moduleConfig);
  }

  async configureModule(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcCallback<UpdateResponse>,
  ) {
    let config = JSON.parse(call.request.config);
    const existingConfig = await this.get(call.request.moduleName);
    if (!existingConfig) {
      await this.set(call.request.moduleName, config);
    }
    config = await this.addFieldsToModule(call.request.moduleName, config);
    return callback(null, { result: JSON.stringify(config) });
  }

  async configurePackage(moduleName: string, config: any) {
    const existingConfig = await this.get(moduleName);
    if (!existingConfig) {
      await this.set(moduleName, config);
    }
    return await this.addFieldsToModule(moduleName, config);
  }

  async addFieldsToModule(moduleName: string, moduleConfig: any) {
    let existingConfig = this._configStorage.getConfig(moduleName);
    existingConfig = { ...moduleConfig, ...existingConfig };
    await this._configStorage.setConfig(moduleName, JSON.stringify(existingConfig));
    return existingConfig;
  }

  async isModuleUp(moduleName: string) {
    if (!this.serviceDiscovery.registeredModules.has(moduleName)) return false;
    try {
      await this.grpcSdk.isModuleUp(
        moduleName,
        this.serviceDiscovery.registeredModules.get(moduleName)!.address[0],
      );
    } catch (e) {
      return false;
    }
    return true;
  }

  addFieldsToConfig(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcCallback<UpdateResponse>,
  ) {
    const newFields = JSON.parse(call.request.config);
    this.addFieldsToModule(call.request.moduleName, newFields)
      .then(r => {
        return callback(null, { result: JSON.stringify(r) });
      })
      .catch(err => {
        callback({
          code: status.INTERNAL,
          message: err.message ? err.message : err,
        });
      });
  }

  private registerAdminRoutes() {
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.getModulesRoute(this.serviceDiscovery.registeredModules),
      );
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.getGetConfigRoute(
          this.grpcSdk,
          this.serviceDiscovery.registeredModules,
        ),
      );
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.getUpdateConfigRoute(
          this.grpcSdk,
          this.sdk,
          this.serviceDiscovery.registeredModules,
        ),
      );
  }
}
