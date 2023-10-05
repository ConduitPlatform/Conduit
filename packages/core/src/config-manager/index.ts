import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitCommons,
  GetConfigResponse,
  GetRedisDetailsResponse,
  IConfigManager,
  UpdateConfigRequest,
  UpdateConfigResponse,
} from '@conduitplatform/commons';
import { runMigrations } from './migrations';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import path from 'path';
import { ServiceDiscovery } from './service-discovery';
import { ConfigStorage } from './config-storage';
import parseConfigSchema from '../utils';
import { IModuleConfig } from '../interfaces/IModuleConfig';
import convict from 'convict';
import { merge } from 'lodash';
import { GrpcServer } from '@conduitplatform/module-tools';
import { RedisOptions } from 'ioredis';

export default class ConfigManager implements IConfigManager {
  grpcSdk: ConduitGrpcSdk;
  private readonly serviceDiscovery: ServiceDiscovery;
  private _configStorage: ConfigStorage;

  constructor(grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitCommons) {
    this.grpcSdk = grpcSdk;
    this.serviceDiscovery = new ServiceDiscovery(grpcSdk);
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
    const loadedState = await this.grpcSdk.state!.getKey('config');
    try {
      if (!loadedState || loadedState.length === 0) return;
      const state = JSON.parse(loadedState);
      const success: IModuleConfig[] = [];
      if (state.modules) {
        for (const module of state.modules) {
          try {
            await this.serviceDiscovery._registerModule(module.name, module.url);
            success.push({
              name: module.name,
              url: module.url,
              instance: module.instance,
              ...(module.configSchema && { configSchema: module.configSchema }),
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

  async recoverConfigRoutes() {
    const loadedState = await this.grpcSdk.state!.getKey('config');
    try {
      if (!loadedState || loadedState.length === 0) return;
      const state = JSON.parse(loadedState);
      if (state.modules) {
        for (const module of state.modules) {
          if (module.configSchema) {
            this.registerConfigRoutes(module.name, module.configSchema);
          }
        }
      } else {
        return Promise.resolve();
      }
    } catch {
      ConduitGrpcSdk.Logger.error('Failed to recover state');
    }
  }

  setState(state: any) {
    this.grpcSdk
      .state!.setKey('config', JSON.stringify(state))
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
    await runMigrations(this.grpcSdk);
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
        this.sdk.getAdmin().handleConfigUpdate(moduleConfig);
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
    if (!this.serviceDiscovery.registeredModules.has(moduleName)) return false;
    try {
      await this.grpcSdk.isModuleUp(
        moduleName,
        this.serviceDiscovery.registeredModules.get(moduleName)!.address,
      );
    } catch (e) {
      return false;
    }
    return true;
  }

  private registerAdminRoutes() {
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.getModulesRoute(this.serviceDiscovery.registeredModules),
      );
  }

  private registerConfigRoutes(
    moduleName: string,
    configSchema: convict.Config<unknown>,
  ) {
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.getMonoConfigRoute(
          this.grpcSdk,
          this.serviceDiscovery.registeredModules,
        ),
      );
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.getModuleConfigRoute(this.grpcSdk, moduleName, configSchema),
      );
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.setModuleConfigRoute(
          this.grpcSdk,
          this.sdk,
          moduleName,
          configSchema,
        ),
      );
  }

  private updateState(name: string, configSchema: convict.Config<any>) {
    this.grpcSdk
      .state!.getKey('config')
      .then(r => {
        if (!r || r.length === 0) {
          throw new Error('No config state found');
        }
        const state = JSON.parse(r);
        const module = state.modules.find((module: IModuleConfig) => {
          return module.name === name;
        });
        if (!module) {
          throw new Error('Cannot update module state');
        }
        state.modules = [
          ...state.modules.filter((module: IModuleConfig) => module.name !== name),
          {
            ...module,
            configSchema,
          },
        ];
        return this.grpcSdk.state!.setKey('config', JSON.stringify(state));
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to recover state');
      });
  }
}
