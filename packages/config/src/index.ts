import { loadPackageDefinition, Server, status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { HealthCheckStatus } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { ConduitCommons, IConfigManager } from '@conduitplatform/commons';
import { EventEmitter } from 'events';
import * as adminRoutes from './admin/routes';
import * as models from './models';

export default class ConfigManager implements IConfigManager {
  databaseCallback: any;
  servingModules: Map<string, string> = new Map<string, string>();
  moduleHealth: { [field: string]: { [field: string]: { timestamp: number, status: HealthCheckStatus } } } = {};
  grpcSdk: ConduitGrpcSdk;
  moduleRegister: EventEmitter;
  private configDocId: string | null = null;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    private readonly sdk: ConduitCommons,
    server: Server,
    packageDefinition: any,
    databaseCallback: any,
  ) {
    const protoDescriptor = loadPackageDefinition(packageDefinition);
    this.grpcSdk = grpcSdk;
    // @ts-ignore
    const config = protoDescriptor.conduit.core.Config;
    server.addService(config.service, {
      get: this.getGrpc.bind(this),
      getServerConfig: this.getServerConfig.bind(this),
      getRedisDetails: this.getRedisDetails.bind(this),
      updateConfig: this.updateConfig.bind(this),
      addFieldsToConfig: this.addFieldsToConfig.bind(this),
      moduleExists: this.moduleExists.bind(this),
      registerModule: this.registerModule.bind(this),
      moduleList: this.moduleList.bind(this),
      watchModules: this.watchModules.bind(this),
      moduleHealthProbe: this.moduleHealthProbe.bind(this),
      getModuleUrlByName: this.getModuleUrlByNameGrpc.bind(this),
    });
    this.databaseCallback = databaseCallback;
    this.moduleRegister = new EventEmitter();
    this.moduleRegister.setMaxListeners(150);
    this.highAvailability();
    const self = this;
    setInterval(() => {
      self.monitorModuleHealth();
    }, 5000);
  }

  async highAvailability() {
    const loadedState = await this.sdk.getState().getKey('config');
    try {
      if (!loadedState || loadedState.length === 0) return;
        let state = JSON.parse(loadedState);
        let success: any[] = [];
        if (state.modules) {
          for (const module of state.modules) {
            try {
              await this._registerModule(module.name, module.url, module.instance);
            } catch {}
            success.push({
              name: module.name,
              url: module.url,
              instance: module.instance,
            });
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

  updateState(name: string, url: string, instance: string) {
    this.sdk
      .getState()
      .getKey('config')
      .then((r) => {
        let state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.modules) state.modules = [];
        state.modules.push({
          name,
          instance,
          url,
        });
        return this.sdk.getState().setKey('config', JSON.stringify(state));
      })
      .then(() => {
        console.log('Updated state');
      })
      .catch(() => {
        console.error('Failed to recover state');
      });
  }

  publishModuleData(type: string, name: string, instance: string, url?: string) {
    this.sdk.getBus().publish(
      'config',
      JSON.stringify({
        type,
        name,
        url,
        instance,
      }),
    );
  }

  getServerConfig(call: any, callback: any) {
    if (!isNil(this.grpcSdk.database)) {
      return models.Config.getInstance()
        .findOne({})
        .then(async (dbConfig: any) => {
          if (isNil(dbConfig)) throw new Error('Config not found in the database');
          callback(null, {
            data: JSON.stringify({
              url: dbConfig['moduleConfigs']['core'].hostUrl,
              env: dbConfig['moduleConfigs']['core'].env,
            }),
          });
        });
    } else {
      callback({
        code: status.INTERNAL,
        message: 'Database provider not set',
      });
    }
  }

  getRedisDetails(call: any, callback: any) {
    callback(null, {
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT,
    });
  }

  initConfigAdminRoutes() {
    this.registerAdminRoutes();
  }

  async registerAppConfig() {
    await this.grpcSdk.database!.createSchemaFromAdapter(models.Config.getInstance(this.grpcSdk.database!));
    let configDoc = await this.grpcSdk.database!.findOne('Config', {});
    if (!configDoc) {
      configDoc = await models.Config.getInstance().create({});
    }
    this.configDocId = (configDoc as any)._id;
  }

  getGrpc(call: any, callback: any) {
    this.get(call.request.key)
      .then((r) => {
        callback(null, { data: JSON.stringify(r) });
      })
      .catch((err) => {
        callback({
          code: status.INTERNAL,
          message: err.message ? err.message : err,
        });
      });
  }

  async get(moduleName: string) {
    if (!isNil(this.grpcSdk.database)) {
      return models.Config.getInstance()
        .findOne({})
        .then(async (dbConfig: any) => {
          if (isNil(dbConfig)) throw new Error('Config not found in the database');
          if (isNil(dbConfig['moduleConfigs'][moduleName]))
            throw new Error(`Config for module "${moduleName}" not set`);
          return dbConfig['moduleConfigs'][moduleName];
        });
    } else {
      throw new Error('Database provider not set');
    }
  }

  async set(moduleName: string, moduleConfig: any) {
    try {
      await models.Config.getInstance().findByIdAndUpdate(
        this.configDocId!,
        { $set: { [`moduleConfigs.${moduleName}`]: moduleConfig } },
      );
      this.sdk.getBus()?.publish(`${moduleName}:update:config`,JSON.stringify(moduleConfig));
      return moduleConfig;
    } catch {
      console.error(`Could not update "${moduleName}" configuration`);
    }
  }

  async updateConfig(call: any, callback: any) {
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
    return models.Config.getInstance()
      .findOne({})
      .then((dbConfig) => {
        if (isNil(dbConfig)) throw new Error('Config not found in the database');
        if (!dbConfig['moduleConfigs']) {
          dbConfig['moduleConfigs'] = {};
        }
        const existing = dbConfig.moduleConfigs[moduleName];
        moduleConfig = { ...moduleConfig, ...existing };

        return models.Config.getInstance().findByIdAndUpdate(dbConfig._id, {
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

  addFieldsToConfig(call: any, callback: any) {
    const newFields = JSON.parse(call.request.config);
    if (!isNil(this.grpcSdk.database)) {
      this.addFieldsToModule(call.request.moduleName, newFields)
        .then((r) => {
          return callback(null, { result: JSON.stringify(r) });
        })
        .catch((err) => {
          callback({
            code: status.INTERNAL,
            message: err.message ? err.message : err,
          });
        });
    } else {
      callback({
        code: status.FAILED_PRECONDITION,
        message: 'Database provider not set',
      });
    }
  }

  moduleExists(call: any, callback: any) {
    if (this.servingModules.has(call.request.moduleName)) {
      callback(null, this.servingModules.get(call.request.moduleName));
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module is missing',
      });
    }
  }

  moduleHealthProbe(call: any, callback: any) {
    if (call.request.status < HealthCheckStatus.UNKNOWN || call.request.status > HealthCheckStatus.NOT_SERVING) {
      callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid module health status code value',
      });
      return;
    }
    this.updateModuleHealth(
      call.request.moduleName,
      call.getPeer(),
      call.request.status as HealthCheckStatus,
    );
    this.publishModuleData('module-health', call.request.moduleName, call.getPeer());
    callback(null, null);
  }

  monitorModuleHealth() {
    let removedCount = 0;
    Object.keys(this.moduleHealth).forEach((moduleName) => {
      const module = this.moduleHealth[moduleName];
      const unhealthyInstances = Object.keys(module).filter(
        (url) => (module[url].timestamp + 5000 < Date.now()) || module[url].status !== HealthCheckStatus.SERVING
      );
      if (unhealthyInstances && unhealthyInstances.length > 0) {
        removedCount += unhealthyInstances.length;
        unhealthyInstances.forEach((url) => {
          delete module[url];
        });
      }
    });
    if (removedCount > 0) {
      const unhealthyModules = Object.keys(this.moduleHealth).filter(
        (moduleName) => Object.keys(this.moduleHealth[moduleName]).length === 0,
      );
      if (unhealthyModules && unhealthyModules.length > 0) {
        unhealthyModules.forEach((moduleName) => {
          //delete this.moduleHealth[moduleName];
          this.servingModules.delete(moduleName);
        });
        this.moduleRegister.emit('serving-modules-update');
      }
    }
  }

  updateModuleHealth(moduleName: string, moduleAddress: string, moduleStatus: HealthCheckStatus) {
    if (!this.moduleHealth[moduleName]) {
      this.moduleHealth[moduleName] = {};
    }
    if (moduleStatus === HealthCheckStatus.SERVING && !this.servingModules.has(moduleName)) {
      this.servingModules.set(moduleName, moduleAddress);
    }
    this.moduleHealth[moduleName][moduleAddress] = {
      timestamp: Date.now(),
      status: moduleStatus,
    };
  }

  moduleList(call: any, callback: any) {
    if (this.servingModules.size !== 0) {
      let modules: any[] = [];
      this.servingModules.forEach((value: string, key: string) => {
        modules.push({
          moduleName: key,
          url: value,
        });
      });
      callback(null, { modules });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Modules not available',
      });
    }
  }

  watchModules(call: any) {
    const self = this;
    this.moduleRegister.on('serving-modules-update', () => {
      let modules: any[] = [];
      self.servingModules.forEach((value: string, key: string) => {
        modules.push({
          moduleName: key,
          url: value,
        });
      });
      call.write({ modules });
    });
    // todo this should close gracefully I guess.
  }

  async registerModule(call: any, callback: any) {
    await this._registerModule(
      call.request.moduleName,
      call.request.url,
      call.getPeer(),
      true,
    );
    this.updateState(call.request.moduleName, call.request.url, call.getPeer());
    this.publishModuleData(
      'serving-modules-update',
      call.request.moduleName,
      call.getPeer(),
      call.request.url,
    );
    callback(null, { result: true });
  }

  getModuleUrlByNameGrpc(call: any, callback: any) {
    let name = call.request.name;
    let result = this.getModuleUrlByName(name);
    if (result) {
      callback(null, { moduleUrl: result });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module not found',
      });
    }
  }

  getModuleUrlByName(
    name: string,
  ): string | undefined {
    return this.servingModules.get(name);
  }

  private async _registerModule(
    moduleName: string,
    moduleUrl: string,
    instancePeer: string,
    fromGrpc = false,
  ) {
    let dbInit = false;
    if (!fromGrpc) {
      if (!this.grpcSdk.getModule(moduleName)) {
        await this.grpcSdk.createModuleClient(moduleName, moduleUrl);
      }
      const healthClient = await this.grpcSdk.getHealthClient(moduleName)!;
      const healthResponse = await healthClient.check({ service: '' })
        .catch(() => {
          throw new Error('Failed to register unhealthy module');
        });
      const healthStatus = (healthResponse.status as unknown as HealthCheckStatus);
      if (healthStatus  !== HealthCheckStatus.SERVING) {
        if (moduleName !== 'database' || healthStatus !== HealthCheckStatus.UNKNOWN) {
          throw new Error('Failed to register unhealthy module');
        }
      }
    }
    if (moduleName === 'database' && this.servingModules.has('database')) {
      dbInit = true;
    }
    this.servingModules.set(moduleName, moduleUrl);
    if (moduleName === 'database' && !dbInit) {
      this.databaseCallback();
    }
    this.updateModuleHealth(moduleName, instancePeer, HealthCheckStatus.SERVING);
    this.moduleRegister.emit('serving-modules-update');
  }

  private registerAdminRoutes() {
    this.sdk.getAdmin().registerRoute(adminRoutes.getModulesRoute(this.servingModules));
    this.sdk.getAdmin().registerRoute(adminRoutes.getGetConfigRoute(this.grpcSdk, this.servingModules));
    this.sdk.getAdmin().registerRoute(adminRoutes.getUpdateConfigRoute(this.grpcSdk, this.sdk, this.servingModules));
  }
}
