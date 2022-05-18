import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  HealthCheckStatus,
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
  IConfigManager, ModuleListResponse,
  RegisteredModule,
  UpdateRequest,
  UpdateResponse,
} from '@conduitplatform/commons';
import { EventEmitter } from 'events';
import { runMigrations } from './migrations';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import path from 'path';

export default class ConfigManager implements IConfigManager {
  databaseCallback: any;
  registeredModules: Map<string, RegisteredModule> = new Map<string, RegisteredModule>();
  moduleHealth: { [field: string]: { [field: string]: { timestamp: number, status: HealthCheckStatus } } } = {};
  grpcSdk: ConduitGrpcSdk;
  moduleRegister: EventEmitter;
  private configDocId: string | null = null;
  private servingStatusUpdate: boolean = false;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    private readonly sdk: ConduitCommons,
    databaseCallback: any,
  ) {
    this.grpcSdk = grpcSdk;
    this.databaseCallback = databaseCallback;
    this.moduleRegister = new EventEmitter();
    this.moduleRegister.setMaxListeners(150);
  }

  async initialize(server: GrpcServer) {
    await server.addService(
      path.resolve(__dirname, '../../core/src/core.proto'),
      'conduit.core.Config',
      {
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
      },
    );
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
            success.push({
              name: module.name,
              url: module.url,
              instance: module.instance,
            });
          } catch {
          }
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
        state.modules = state.modules.filter((module: { name: string, instance: string, url: string }) => {
          return module.url !== url;
        });
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

  getServerConfig(call: GrpcRequest<null>, callback: GrpcCallback<GetConfigResponse>) {
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

  getRedisDetails(call: GrpcRequest<null>, callback: GrpcCallback<GetRedisDetailsResponse>) {
    callback(null, {
      redisHost: process.env.REDIS_HOST!,
      redisPort: parseInt(process.env.REDIS_PORT!),
    });
  }

  initConfigAdminRoutes() {
    this.registerAdminRoutes();
  }

  async registerAppConfig() {
    await this.grpcSdk.database!.createSchemaFromAdapter(models.Config.getInstance(this.grpcSdk.database!));
    await runMigrations(this.grpcSdk);
    let configDoc = await this.grpcSdk.database!.findOne('Config', {});
    if (!configDoc) {
      configDoc = await models.Config.getInstance().create({});
    }
    this.configDocId = (configDoc as any)._id;
  }

  getGrpc(call: GrpcRequest<{ key: string; }>, callback: GrpcResponse<{ data: string; }>) {
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
        .then(async (dbConfig) => {
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
      switch (moduleName) {
        case 'core':
          this.sdk.getCore().setConfig(moduleConfig);
          break;
        case 'admin':
          this.sdk.getAdmin().setConfig(moduleConfig);
          break;
        case 'router':
          this.sdk.getRouter().setConfig(moduleConfig);
          break;
        case 'security':
          this.sdk.getSecurity().setConfig(moduleConfig);
          break;
        default:
          break;
      }
      return moduleConfig;
    } catch {
      console.error(`Could not update "${moduleName}" configuration`);
    }
  }

  async updateConfig(call: GrpcRequest<UpdateRequest>, callback: GrpcCallback<UpdateResponse>) {
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

  addFieldsToConfig(call: GrpcRequest<UpdateRequest>, callback: GrpcCallback<UpdateResponse>) {
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

  moduleExists(call: GrpcRequest<{ moduleName: string }>, callback: GrpcResponse<string>) {
    if (this.registeredModules.has(call.request.moduleName)) {
      callback(null, this.registeredModules.get(call.request.moduleName)!.address);
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module is missing',
      });
    }
  }

  moduleHealthProbe(call: any, callback: GrpcResponse<null>) {
    if (call.request.status < HealthCheckStatus.UNKNOWN || call.request.status > HealthCheckStatus.NOT_SERVING) {
      callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid module health status code value',
      });
      return;
    }
    this.updateModuleHealth(
      call.request.moduleName,
      call.request.url,
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
      const offlineInstances = Object.keys(module).filter(
        (url) => (module[url].timestamp + 5000 < Date.now()),
      );
      const nonServingInstances = Object.keys(module).filter(
        (url) => module[url].status !== HealthCheckStatus.SERVING,
      );
      if (offlineInstances?.length > 0 || nonServingInstances.length > 0) {
        removedCount += offlineInstances.length + nonServingInstances.length;
        offlineInstances.forEach((url) => {
          delete module[url];
        });
      }
    });
    if (removedCount > 0) {
      const unhealthyModules = Object.keys(this.moduleHealth).filter(
        (moduleName) => Object.keys(this.moduleHealth[moduleName]).length === 0,
      );
      if (unhealthyModules?.length > 0) {
        unhealthyModules.forEach((moduleName) => {
          delete this.moduleHealth[moduleName];
          this.registeredModules.delete(moduleName);
        });
        this.servingStatusUpdate = true;
      }
    }
    if (this.servingStatusUpdate) {
      this.moduleRegister.emit('serving-modules-update');
      this.servingStatusUpdate = false;
    }
  }

  updateModuleHealth(
    moduleName: string,
    moduleUrl: string,
    moduleAddress: string,
    moduleStatus: HealthCheckStatus,
    broadcast = true,
  ) {
    if (!this.moduleHealth[moduleName]) {
      this.moduleHealth[moduleName] = {};
    }
    let module = this.registeredModules.get(moduleName);
    if (!module) {
      module = {
        address: moduleUrl,
        serving: moduleStatus === HealthCheckStatus.SERVING,
      };
      this.registeredModules.set(moduleName, module);
      this.moduleRegister.emit('serving-modules-update');
    }
    const prevStatus = module.serving;
    module.serving = moduleStatus === HealthCheckStatus.SERVING;
    if (!this.servingStatusUpdate && prevStatus !== module.serving && broadcast) {
      this.servingStatusUpdate = true;
    }
    this.registeredModules.set(moduleName, module);
    this.moduleHealth[moduleName][moduleAddress] = {
      timestamp: Date.now(),
      status: moduleStatus,
    };
  }

  moduleList(call: GrpcRequest<null>, callback: GrpcCallback<ModuleListResponse>) {
    if (this.registeredModules.size !== 0) {
      let modules: {
        moduleName: string;
        url: string;
        serving: boolean
      }[] = [];
      this.registeredModules.forEach((value: RegisteredModule, key: string) => {
        modules.push({
          moduleName: key,
          url: value.address,
          serving: value.serving,
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
      self.registeredModules.forEach((value: RegisteredModule, key: string) => {
        modules.push({
          moduleName: key,
          url: value.address,
          serving: value.serving,
        });
      });
      call.write({ modules });
    });
    // todo this should close gracefully I guess.
  }

  async registerModule(call: any, callback: GrpcResponse<{ result: boolean }>) {
    if (call.request.status < HealthCheckStatus.UNKNOWN || call.request.status > HealthCheckStatus.NOT_SERVING) {
      callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid module health status code value',
      });
      return;
    }
    await this._registerModule(
      call.request.moduleName,
      call.request.url,
      call.getPeer(),
      (call.request.healthStatus as HealthCheckStatus),
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

  getModuleUrlByNameGrpc(call: GrpcRequest<{ name: string }>, callback: GrpcResponse<{ moduleUrl: string }>) {
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
    return this.registeredModules.get(name)?.address;
  }

  private async _registerModule(
    moduleName: string,
    moduleUrl: string,
    instancePeer: string,
    healthStatus?: HealthCheckStatus,
    fromGrpc = false,
  ) {
    if (fromGrpc && healthStatus === undefined) {
      throw new Error('No module health status provided');
    }
    let dbInit = false;
    if (!fromGrpc) {
      if (!this.grpcSdk.getModule(moduleName)) {
        await this.grpcSdk.createModuleClient(moduleName, moduleUrl);
      }
      const healthClient = await this.grpcSdk.getHealthClient(moduleName)!;
      const healthResponse = await healthClient.check({ service: '' })
        .catch(() => {
          throw new Error('Failed to register unresponsive module');
        });
      healthStatus = (healthResponse.status as unknown as HealthCheckStatus);
    }
    if (moduleName === 'database' && this.registeredModules.has('database')) {
      dbInit = true;
    }
    this.registeredModules.set(moduleName, {
      address: moduleUrl,
      serving: healthStatus === HealthCheckStatus.SERVING,
    });
    if (moduleName === 'database' && !dbInit) {
      await this.grpcSdk.refreshModules(true);
      this.databaseCallback();
    }
    this.updateModuleHealth(moduleName, moduleUrl, instancePeer, HealthCheckStatus.SERVING, false);
    this.moduleRegister.emit('serving-modules-update');
  }

  private registerAdminRoutes() {
    this.sdk.getAdmin().registerRoute(adminRoutes.getModulesRoute(this.registeredModules));
    this.sdk.getAdmin().registerRoute(adminRoutes.getGetConfigRoute(this.grpcSdk, this.registeredModules));
    this.sdk.getAdmin().registerRoute(adminRoutes.getUpdateConfigRoute(this.grpcSdk, this.sdk, this.registeredModules));
  }
}
