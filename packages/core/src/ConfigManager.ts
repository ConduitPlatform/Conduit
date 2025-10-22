import { status } from '@grpc/grpc-js';
import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import {
  GetConfigResponse,
  GetRedisDetailsResponse,
  UpdateConfigRequest,
  UpdateConfigResponse,
} from './interfaces/index.js';
import * as models from './config-models/index.js';
import path from 'path';
import { ServiceDiscovery } from './service-discovery/index.js';
import { ConfigStorage } from './storage/index.js';
import parseConfigSchema from './utils/index.js';
import { IModuleConfig } from './interfaces/IModuleConfig.js';
import convict from 'convict';
import { merge } from 'lodash-es';
import { GrpcServer } from '@conduitplatform/module-tools';
import { RedisOptions } from 'ioredis';
import { ServiceRegistry } from './service-discovery/ServiceRegistry.js';
import { fileURLToPath } from 'node:url';

export default class ConfigManager {
  grpcSdk: ConduitGrpcSdk;
  private readonly serviceDiscovery: ServiceDiscovery;
  private _configStorage: ConfigStorage;
  private adminModule: any;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    private readonly core: any,
  ) {
    this.grpcSdk = grpcSdk;
    this.serviceDiscovery = new ServiceDiscovery(grpcSdk);
    this._configStorage = new ConfigStorage(core, grpcSdk, this.serviceDiscovery);
  }

  setAdminModule(adminModule: any) {
    this.adminModule = adminModule;
  }

  getModuleUrlByName(moduleName: string): string | undefined {
    return this.serviceDiscovery.getModuleUrlByName(moduleName);
  }

  getModuleUrlByNameGrpc(
    call: GrpcRequest<{ name: string }>,
    callback: GrpcResponse<{ moduleUrl: string }>,
  ) {
    const name = call.request.name;
    const result = this.getModuleUrlByName(name);
    if (!result) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Module not found',
      });
    }
    callback(null, { moduleUrl: result });
  }

  async initialize(server: GrpcServer) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    await server.addService(
      path.resolve(__dirname, './core.proto'),
      'conduit.core.Config',
      {
        get: this.getGrpc.bind(this),
        getServerConfig: this.getServerConfig.bind(this),
        getRedisDetails: this.getRedisDetails.bind(this),
        configure: this.configureModule.bind(this),
        moduleExists: this.serviceDiscovery.moduleExists.bind(this.serviceDiscovery),
        registerModule: this.serviceDiscovery.registerModule.bind(this.serviceDiscovery),
        moduleList: this.serviceDiscovery.moduleList.bind(this.serviceDiscovery),
        watchModules: this.serviceDiscovery.watchModules.bind(this.serviceDiscovery),
        moduleHealthProbe: this.serviceDiscovery.moduleHealthProbe.bind(
          this.serviceDiscovery,
        ),
        getModuleUrlByName: this.getModuleUrlByNameGrpc.bind(this.serviceDiscovery),
      },
    );
    this.serviceDiscovery.beginMonitors();
  }

  async recoverConfigRoutes() {
    const loadedState = await this.grpcSdk.state!.getState();
    try {
      if (!loadedState || loadedState.length === 0) return;
      const state = JSON.parse(loadedState);
      if (!state.modules) return Promise.resolve();
      for (const module of state.modules) {
        if (module.configSchema) {
          this.registerConfigRoutes(module.name, module.configSchema);
        }
      }
    } catch {
      ConduitGrpcSdk.Logger.error('Failed to recover state');
    }
  }

  getServerConfig(call: GrpcRequest<null>, callback: GrpcCallback<GetConfigResponse>) {
    this._configStorage
      .getConfig('core')
      .then(config => {
        callback(null, {
          data: JSON.stringify({
            url: (config! as unknown as { hostUrl: string }).hostUrl,
            env: (config! as unknown as { env: string })!.env,
          }),
        });
      })
      .catch(() => {
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
    const redisDetails = this.grpcSdk.redisDetails;
    if (redisDetails.hasOwnProperty('nodes')) {
      callback(null, {
        cluster: JSON.stringify(redisDetails),
      });
    } else {
      callback(null, {
        standalone: JSON.stringify(redisDetails),
        // maintain backwards compatibility with <=grpc-sdk-v0.16.0-alpha.20
        redisHost: (redisDetails as RedisOptions).host,
        redisPort: (redisDetails as RedisOptions).port,
        redisUsername: (redisDetails as RedisOptions).username,
        redisPassword: (redisDetails as RedisOptions).password,
      });
    }
  }

  initConfigAdminRoutes() {
    this.registerAdminRoutes();
    this.recoverConfigRoutes();
  }

  async registerAppConfig() {
    const modelInstance = models.Config.getInstance(this.grpcSdk.database!);
    await this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    await this.grpcSdk.database!.migrate(modelInstance.name);
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
      if (moduleName === 'admin') {
        this.grpcSdk.bus!.publish('admin:config:update', JSON.stringify(moduleConfig));
        // Note: Admin module will handle config updates through its own subscription
      }
      return moduleConfig;
    } catch (e) {
      ConduitGrpcSdk.Logger.error(`Could not update "${moduleName}" configuration`);
    }
  }

  async configureModule(
    call: GrpcRequest<UpdateConfigRequest>,
    callback: GrpcCallback<UpdateConfigResponse>,
  ) {
    const moduleName = call.metadata!.get('module-name')![0] as string;
    let config = JSON.parse(call.request.config);
    const configSchema = JSON.parse(call.request.schema);
    parseConfigSchema(configSchema);
    if (call.request.override) {
      await this.set(moduleName, config);
    } else {
      const existingConfig = await this.get(moduleName);
      if (!existingConfig) {
        await this.set(moduleName, config);
      }
      config = await this.addFieldsToModule(moduleName, config);
    }
    this.registerConfigRoutes(moduleName, configSchema);
    this.updateState(moduleName, configSchema);
    return callback(null, { result: JSON.stringify(config) });
  }

  async configurePackage(moduleName: string, config: any, schema: any) {
    const existingConfig = await this.get(moduleName);
    if (!existingConfig) {
      await this.set(moduleName, config);
    }
    parseConfigSchema(schema);
    this.registerConfigRoutes(moduleName, schema);
    return await this.addFieldsToModule(moduleName, config);
  }

  async addFieldsToModule(moduleName: string, moduleConfig: any) {
    const existingConfig = await this._configStorage.getConfig(moduleName);
    const mergedConfig = merge(moduleConfig, existingConfig);
    await this._configStorage.setConfig(moduleName, JSON.stringify(mergedConfig));
    return mergedConfig;
  }

  async isModuleUp(moduleName: string) {
    const module = ServiceRegistry.getInstance().getModule(moduleName);
    if (!module) return false;
    try {
      await this.grpcSdk.isModuleUp(moduleName, module.address);
    } catch (e) {
      return false;
    }
    return true;
  }

  private registerAdminRoutes() {
    // Note: Admin routes will be registered by the admin module itself
  }

  private registerConfigRoutes(
    moduleName: string,
    configSchema: convict.Config<unknown>,
  ) {
    if (this.adminModule) {
      this.adminModule.registerConfigRoutes(moduleName, configSchema);
    }
  }

  private updateState(name: string, configSchema: convict.Config<any>) {
    this.grpcSdk
      .state!.modifyState(async (existingState: Indexable) => {
        const state = existingState ?? {};
        const module = state.modules.find((module: IModuleConfig) => {
          return module.name === name;
        });
        if (!module) {
          throw new Error(`Config-manager: ${name} not found in state`);
        }
        state.modules = [
          ...state.modules.filter((module: IModuleConfig) => module.name !== name),
          {
            ...module,
            configSchema,
          },
        ];
        return state;
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log(`Config-manager: Updated state for ${name}`);
      })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
        ConduitGrpcSdk.Logger.error(`Config-manager: Failed to update ${name} state`);
      });
  }
}
