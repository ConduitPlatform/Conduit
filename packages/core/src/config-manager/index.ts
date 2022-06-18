import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  GrpcServer,
  GrpcRequest,
  GrpcResponse,
  GrpcCallback,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
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

export default class ConfigManager implements IConfigManager {
  grpcSdk: ConduitGrpcSdk;
  private configDocId: string | null = null;
  private readonly serviceDiscovery: ServiceDiscovery;
  private _isPrimary = true;

  constructor(grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitCommons) {
    this.grpcSdk = grpcSdk;
    this.serviceDiscovery = new ServiceDiscovery(grpcSdk, sdk);
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
    this.highAvailability();
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
        return this.grpcSdk.initializeModules();
      } else {
        return Promise.resolve();
      }
    } catch {
      console.error('Failed to recover state');
    }
  }

  setState(state: any) {
    this.sdk
      .getState()
      .setKey('config', JSON.stringify(state))
      .then(() => {
        console.log('Updated state');
      })
      .catch(() => {
        console.error('Failed to recover state');
      });
  }

  getServerConfig(call: GrpcRequest<null>, callback: GrpcCallback<GetConfigResponse>) {
    this.sdk
      .getState()
      .getKey('moduleConfigs')
      .then((config: string | null) => {
        if (!config) {
          return callback({
            code: status.NOT_FOUND,
            message: 'Server config not found!',
          });
        }
        config = JSON.parse(config).core;
        callback(null, {
          data: JSON.stringify({
            url: ((config! as unknown) as { hostUrl: string }).hostUrl,
            env: ((config! as unknown) as { env: string })!.env,
          }),
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
    let configDoc: models.Config | null = await this.grpcSdk.database!.findOne(
      'Config',
      {},
    );
    if (!configDoc) {
      configDoc = await models.Config.getInstance().create({});
      for (const key in this.serviceDiscovery.registeredModules.keys()) {
        let config: string | null = await this.sdk
          .getState()
          .getKey(`moduleConfigs.${key}`);
        if (!config) {
          continue;
        }
        configDoc.moduleConfigs[key] = JSON.parse(config);
      }
      // flush redis stored configuration to the database
      if (Object.keys(configDoc.moduleConfigs).length > 0) {
        await models.Config.getInstance().findByIdAndUpdate(configDoc._id, {
          moduleConfigs: configDoc.moduleConfigs,
        });
      }
    } else {
      Object.keys(configDoc.moduleConfigs).forEach(key => {
        this.sdk
          .getState()
          .setKey(`moduleConfigs.${key}`, JSON.stringify(configDoc!.moduleConfigs[key]));
      });
    }
    this.configDocId = (configDoc as any)._id;
  }

  getGrpc(call: GrpcRequest<{ key: string }>, callback: GrpcResponse<{ data: string }>) {
    this.get(call.request.key)
      .then(r => {
        callback(null, { data: JSON.stringify(r) });
      })
      .catch(err => {
        callback({
          code: status.INTERNAL,
          message: err.message ? err.message : err,
        });
      });
  }

  async get(moduleName: string) {
    let config: string | null = await this.sdk
      .getState()
      .getKey(`moduleConfigs.${moduleName}`);
    if (!config) {
      throw new Error('Config not found in the database');
    }
    let configuration: { moduleConfigs: any } = { moduleConfigs: {} };
    configuration.moduleConfigs = JSON.parse(config);
    if (!configuration['moduleConfigs'][moduleName]) {
      throw new Error(`Config for module "${moduleName}" not set`);
    }
    return configuration['moduleConfigs'][moduleName];
  }

  async set(moduleName: string, moduleConfig: any) {
    try {
      await this.sdk
        .getState()
        .setKey(`moduleConfigs.${moduleName}`, JSON.stringify(moduleConfig));
      if (this.grpcSdk.isAvailable('database')) {
        await models.Config.getInstance().findByIdAndUpdate(this.configDocId!, {
          $set: { [`moduleConfigs.${moduleName}`]: moduleConfig },
        });
      }
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
    } catch {
      console.error(`Could not update "${moduleName}" configuration`);
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

  async addFieldsToModule(moduleName: string, moduleConfig: any) {
    let existingConfig = await this.sdk.getState().getKey(`moduleConfigs.${moduleName}`);
    if (!existingConfig) throw new Error('Config not found in the database');
    let parsedConfig = JSON.parse(existingConfig);
    parsedConfig = { ...moduleConfig, ...parsedConfig };
    await this.sdk.getState().setKey(`moduleConfigs.${moduleName}`, parsedConfig);
    if (this.grpcSdk.isAvailable('database')) {
      models.Config.getInstance()
        .findOne({})
        .then(dbConfig => {
          if (isNil(dbConfig)) throw new Error('Config not found in the database');
          if (!dbConfig['moduleConfigs']) {
            dbConfig['moduleConfigs'] = {};
          }
          const existing = dbConfig.moduleConfigs[moduleName];
          moduleConfig = { ...moduleConfig, ...existing };

          return models.Config.getInstance()
            .findByIdAndUpdate(dbConfig._id, {
              $set: { [`moduleConfigs.${moduleName}`]: moduleConfig },
            })
            .catch(() => {
              console.error(`Could not add fields to "${moduleName}" configuration`);
            });
        })
        .then(() => {
          return moduleConfig;
        });
    }

    return parsedConfig;
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
