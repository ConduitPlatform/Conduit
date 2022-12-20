import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  GrpcServer,
  HealthCheckStatus,
  registerMigrations,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitCommons,
  GetConfigResponse,
  GetRedisDetailsResponse,
  IConfigManager,
  UpdateRequest,
  UpdateResponse,
} from '@conduitplatform/commons';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import { ServiceDiscovery } from './service-discovery';
import { ConfigStorage } from './config-storage';
import parseConfigSchema from '../utils';
import { ServiceDiscoveryState, ServiceDiscoveryModuleEntry } from '../interfaces';
import { isNil } from 'lodash';
import convict from 'convict';
import fs from 'fs-extra';
import path from 'path';

export default class ConfigManager implements IConfigManager {
  private readonly serviceDiscovery: ServiceDiscovery;
  private _configStorage: ConfigStorage;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly sdk: ConduitCommons,
    readonly conduitHealthCheckGetter: (service: '') => HealthCheckStatus,
  ) {
    this.serviceDiscovery = new ServiceDiscovery(grpcSdk, conduitHealthCheckGetter);
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
        registerModule: this.serviceDiscovery.registerModuleGrpc.bind(
          this.serviceDiscovery,
        ),
        getDeploymentState: this.serviceDiscovery.getDeploymentState.bind(
          this.serviceDiscovery,
        ),
        watchDeploymentState: this.serviceDiscovery.watchDeploymentState.bind(
          this.serviceDiscovery,
        ),
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
    const loadedState = await this.grpcSdk.state!.getKey('serviceDiscovery');
    try {
      if (!loadedState || loadedState.length === 0) return;
      const state: ServiceDiscoveryState = JSON.parse(loadedState);
      const success: ServiceDiscoveryModuleEntry[] = [];
      if (state.modules) {
        for (const module of state.modules) {
          try {
            await this.serviceDiscovery._registerModule(module.manifest, module.url);
            success.push(module);
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
      ConduitGrpcSdk.Logger.error('Failed to recover Redis state');
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

  private getServerConfig(
    call: GrpcRequest<null>,
    callback: GrpcCallback<GetConfigResponse>,
  ) {
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

  private getRedisDetails(
    call: GrpcRequest<null>,
    callback: GrpcCallback<GetRedisDetailsResponse>,
  ) {
    let redisJson;
    const redisConfig = process.env.REDIS_CONFIG;
    if (redisConfig) {
      if (redisConfig.startsWith('{')) {
        try {
          redisJson = JSON.parse(redisConfig);
        } catch (e) {
          return callback({
            code: status.INTERNAL,
            message: 'Failed to parse redis config',
          });
        }
      } else {
        try {
          redisJson = JSON.parse(fs.readFileSync(redisConfig, 'utf8'));
        } catch (e) {
          return callback({
            code: status.INTERNAL,
            message: 'Failed to parse redis config',
          });
        }
      }
    }
    if (!isNil(redisJson)) {
      callback(null, {
        redisConfig: JSON.stringify(redisJson),
      });
    } else {
      callback(null, {
        redisHost: process.env.REDIS_HOST!,
        redisPort: parseInt(process.env.REDIS_PORT!),
        redisPassword: process.env.REDIS_PASSWORD,
        redisUsername: process.env.REDIS_USERNAME,
      });
    }
  }

  initConfigAdminRoutes() {
    this.registerAdminRoutes();
    this.recoverConfigRoutes();
  }

  async registerAppConfig() {
    await this.grpcSdk.database!.createSchemaFromAdapter(
      models.Config.getInstance(this.grpcSdk.database!),
    );
    // TODO: core should run admin's migrations too in order to store a correct module version
    const migrationFilePath = path.resolve(__dirname, 'migrations');
    await registerMigrations(this.grpcSdk.database!, 'core', migrationFilePath);
    this._configStorage.onDatabaseAvailable();
  }

  private getGrpc(
    call: GrpcRequest<{ key: string }>,
    callback: GrpcResponse<{ data: string }>,
  ) {
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

  private async configureModule(
    call: GrpcRequest<UpdateRequest>,
    callback: GrpcCallback<UpdateResponse>,
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
    this.updateRedisState(moduleName, configSchema);
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
    let existingConfig = await this._configStorage.getConfig(moduleName);
    existingConfig = { ...moduleConfig, ...existingConfig };
    await this._configStorage.setConfig(moduleName, JSON.stringify(existingConfig));
    return existingConfig;
  }

  async isModuleUp(moduleName: string) {
    const module = this.serviceDiscovery.registeredModules.get(moduleName);
    if (!module || module.pending) return false;
    try {
      await this.grpcSdk.checkServiceHealth(module.moduleUrl);
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

  private registerConfigRoutes(moduleName: string, configSchema: convict.Config<any>) {
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.registerConfigRoute(
          this.grpcSdk,
          this.sdk,
          moduleName,
          configSchema,
          ConduitRouteActions.GET,
        ),
      );
    this.sdk
      .getAdmin()
      .registerRoute(
        adminRoutes.registerConfigRoute(
          this.grpcSdk,
          this.sdk,
          moduleName,
          configSchema,
          ConduitRouteActions.PATCH,
        ),
      );
  }

  private updateRedisState(moduleName: string, configSchema: convict.Config<object>) {
    this.grpcSdk
      .state!.getKey('serviceDiscovery')
      .then(r => {
        if (!r || r.length === 0) {
          throw new Error('No config state found');
        }
        const state: ServiceDiscoveryState = JSON.parse(r);
        const module = state.modules.find(m => m.manifest.moduleName === moduleName);
        if (!module) {
          throw new Error('Cannot update module state');
        }
        state.modules = [
          ...state.modules.filter(m => m.manifest.moduleName !== moduleName),
          {
            ...module,
            configSchema,
          },
        ];
        return this.grpcSdk.state!.setKey('serviceDiscovery', JSON.stringify(state));
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated Redis state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to recover Redis state');
      });
  }
}
