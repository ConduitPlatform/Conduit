import { loadPackageDefinition, Server, status } from '@grpc/grpc-js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { DatabaseConfigUtility } from './utils/config';
import { ConduitCommons, IConfigManager } from '@conduitplatform/commons';
import { EventEmitter } from 'events';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import axios from 'axios';

export default class ConfigManager implements IConfigManager {
  databaseCallback: any;
  registeredModules: Map<string, string> = new Map<string, string>();
  moduleHealth: any = {};
  grpcSdk: ConduitGrpcSdk;
  moduleRegister: EventEmitter;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    private readonly sdk: ConduitCommons,
    server: Server,
    packageDefinition: any,
    databaseCallback: any
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
      addFieldstoConfig: this.addFieldstoConfig.bind(this),
      moduleExists: this.moduleExists.bind(this),
      registerModule: this.registerModule.bind(this),
      moduleList: this.moduleList.bind(this),
      watchModules: this.watchModules.bind(this),
      moduleHealthProbe: this.moduleHealthProbe.bind(this),
      getModuleUrlByInstance: this.getModuleUrlByInstanceGrpc.bind(this),
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

  highAvailability() {
    const self = this;
    this.sdk
      .getState()
      .getKey('config')
      .then((r) => {
        if (!r || r.length === 0) return;
        let state = JSON.parse(r);
        let success: any[] = [];
        if (state.modules) {
          let promise = Promise.resolve();
          state.modules.forEach((r: any) => {
            promise = promise
              .then(() => {
                return self._registerModule(r.name, r.url, r.instance);
              })
              .then(() => {
                success.push({
                  name: r.name,
                  url: r.url,
                  instance: r.instance,
                });
              })
              .catch(() => {
                return Promise.resolve();
              });
          });
          promise
            .then(() => {
              if (state.modules.length > success.length) {
                state.modules = success;
                self.setState(state);
              }
              return;
            })
            .then(() => {
              return this.grpcSdk.initializeModules();
            });
        }
      })
      // DO NOT INITIALIZE THE BUS BEFORE RECOVERY
      .then(() => {
        this.sdk.getBus().subscribe('config', (message: string) => {
          let messageParsed = JSON.parse(message);
          if (messageParsed.type === 'module-registered') {
            self._registerModule(
              messageParsed.name,
              messageParsed.url,
              messageParsed.instance
            );
          } else if (messageParsed.type === 'module-health') {
            self.updateModuleHealth(messageParsed.name, messageParsed.instance);
          }
        });
      })
      .catch((err) => {
        console.log('Failed to recover state');
      });
  }

  setState(state: any) {
    this.sdk
      .getState()
      .setKey('config', JSON.stringify(state))
      .then((r) => {
        console.log('Updated state');
      })
      .catch((err) => {
        console.log('Failed to recover state');
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
      .then((r) => {
        console.log('Updated state');
      })
      .catch((err) => {
        console.log('Failed to recover state');
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
      })
    );
  }

  getServerConfig(call: any, callback: any) {
    if (!isNil(this.grpcSdk.databaseProvider)) {
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
    await this.grpcSdk.waitForExistence('database');
    models.Config.getInstance(this.grpcSdk.databaseProvider!);
    await this.getDatabaseConfigUtility().registerConfigSchemas(models.Config.getPlainSchema());
  }

  getDatabaseConfigUtility() {
    return new DatabaseConfigUtility(this.grpcSdk);
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

  async get(name: string) {
    if (!isNil(this.grpcSdk.databaseProvider)) {
      return models.Config.getInstance()
        .findOne({})
        .then(async (dbConfig: any) => {
          if (isNil(dbConfig)) throw new Error('Config not found in the database');
          if (isNil(dbConfig['moduleConfigs'][name]))
            throw new Error(`Config for module "${name} not set`);
          return dbConfig['moduleConfigs'][name];
        });
    } else {
      throw new Error('Database provider not set');
    }
  }

  async set(name: string, newModulesConfigSchemaFields: any) {
    return this.registerModulesConfig(name, newModulesConfigSchemaFields);
  }

  updateConfig(call: any, callback: any) {
    const newConfig = JSON.parse(call.request.config);
    if (!isNil(this.grpcSdk.databaseProvider)) {
      models.Config.getInstance()
        .findOne({})
        .then((dbConfig) => {
          if (isNil(dbConfig)) throw new Error('Config not found in the database');
          if (!dbConfig['moduleConfigs']) {
            dbConfig['moduleConfigs'] = {};
          }
          let modName = 'moduleConfigs.' + call.request.moduleName;
          return models.Config.getInstance().findByIdAndUpdate(dbConfig._id, {
              $set: { [modName]: newConfig },
            })
            .then((updatedConfig: any) => {
              delete updatedConfig._id;
              delete updatedConfig.createdAt;
              delete updatedConfig.updatedAt;
              delete updatedConfig.__v;
              return callback(null, {
                result: JSON.stringify(
                  updatedConfig['moduleConfigs'][call.request.moduleName]
                ),
              });
            });
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

  async addFieldsToModule(name: string, config: any) {
    return models.Config.getInstance()
      .findOne({})
      .then((dbConfig) => {
        if (isNil(dbConfig)) throw new Error('Config not found in the database');
        if (!dbConfig['moduleConfigs']) {
          dbConfig['moduleConfigs'] = {};
        }
        let modName = 'moduleConfigs.' + name;
        // keep only new fields
        let existing = dbConfig.moduleConfigs[name];
        config = { ...config, ...existing };
        return models.Config.getInstance().findByIdAndUpdate(dbConfig._id, {
          $set: { [modName]: config },
        });
      })
      .then((updatedConfig: any) => {
        delete updatedConfig._id;
        delete updatedConfig.createdAt;
        delete updatedConfig.updatedAt;
        delete updatedConfig.__v;
        return updatedConfig['moduleConfigs'][name];
      });
  }

  addFieldstoConfig(call: any, callback: any) {
    let newFields = JSON.parse(call.request.config);
    if (!isNil(this.grpcSdk.databaseProvider)) {
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

  async registerModulesConfig(name: string, newModulesConfigSchemaFields: any) {
    await this.grpcSdk.waitForExistence('database');
    models.Config.getInstance().findOne({}).then((dbConfig) => {
      if (isNil(dbConfig)) throw new Error('Config not found in the database');
      if (!dbConfig['moduleConfigs']) {
        dbConfig['moduleConfigs'] = {};
      }
      let modName = 'moduleConfigs.' + name;
      return models.Config.getInstance().findByIdAndUpdate(dbConfig._id, {
          $set: { [modName]: newModulesConfigSchemaFields },
        })
        .then((updatedConfig: any) => {
          delete updatedConfig._id;
          delete updatedConfig.createdAt;
          delete updatedConfig.updatedAt;
          delete updatedConfig.__v;
          return updatedConfig['moduleConfigs'][name];
        });
    });
  }

  moduleExists(call: any, callback: any) {
    if (this.registeredModules.has(call.request.moduleName)) {
      callback(null, this.registeredModules.get(call.request.moduleName));
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module is missing',
      });
    }
  }

  moduleHealthProbe(call: any, callback: any) {
    this.updateModuleHealth(call.request.moduleName, call.getPeer());
    this.publishModuleData('module-health', call.request.moduleName, call.getPeer());
    callback(null, null);
  }

  monitorModuleHealth() {
    let removedCount = 0;
    Object.keys(this.moduleHealth).forEach((r) => {
      let module = this.moduleHealth[r];
      let unhealthyInstances = Object.keys(module).filter(
        (instance) => module[instance] + 5000 < Date.now()
      );
      if (unhealthyInstances && unhealthyInstances.length > 0) {
        removedCount += unhealthyInstances.length;
        unhealthyInstances.forEach((instance) => {
          delete module[instance];
        });
      }
    });
    if (removedCount > 0) {
      let unhealthyModules = Object.keys(this.moduleHealth).filter(
        (module) => Object.keys(module).length === 0
      );
      if (unhealthyModules && unhealthyModules.length > 0) {
        unhealthyModules.forEach((r) => {
          delete this.moduleHealth[r];
        });
        this.moduleRegister.emit('module-registered');
      }
    }
  }

  updateModuleHealth(moduleName: string, moduleAddress: string) {
    if (!this.moduleHealth[moduleName]) {
      this.moduleHealth[moduleName] = {};
    }
    let instanceName = moduleName + '-' + moduleAddress;
    let moduleInstances = this.moduleHealth[moduleName];
    moduleInstances[instanceName] = Date.now();
  }

  moduleList(call: any, callback: any) {
    if (this.registeredModules.size !== 0) {
      let modules: any[] = [];
      this.registeredModules.forEach((value: string, key: string) => {
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

  watchModules(call: any, callback: any) {
    const self = this;
    this.moduleRegister.on('module-registered', () => {
      let modules: any[] = [];
      self.registeredModules.forEach((value: string, key: string) => {
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
      true
    );
    this.updateState(call.request.moduleName, call.request.url, call.getPeer());
    this.publishModuleData(
      'module-registered',
      call.request.moduleName,
      call.getPeer(),
      call.request.url
    );
    callback(null, { result: true });
  }

  getModuleUrlByInstanceGrpc(call: any, callback: any) {
    let instance = call.request.instancePeer;
    let result = this.getModuleUrlByInstance(instance);
    if (result) {
      callback(null, { moduleUrl: result.url, moduleName: result.moduleName });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module not found',
      });
    }
  }

  getModuleUrlByInstance(
    instancePeer: string
  ): { url: string; moduleName: string } | undefined {
    let found = null;
    Object.keys(this.moduleHealth).forEach((r) => {
      Object.keys(this.moduleHealth[r]).forEach((i) => {
        if (i.indexOf(instancePeer) !== -1) {
          found = r;
          return;
        }
      });
    });
    if (found) {
      return { url: this.registeredModules.get(found)!, moduleName: found };
    } else {
      return undefined;
    }
  }

  private async _registerModule(
    moduleName: string,
    moduleUrl: string,
    instancePeer: string,
    fromGrpc = false
  ) {
    let dbInit = false;
    if (!fromGrpc) {
      let failed: any;
      await axios.get('http://' + moduleUrl).catch((err: any) => {
        failed = err;
      });
      if (failed && failed.message.indexOf('Parse Error') === -1) {
        throw new Error('Failed to register dead module');
      }
    }
    if (
      moduleName === 'database' &&
      this.registeredModules.has('database')
    ) {
      dbInit = true;
    }
    this.registeredModules.set(moduleName, moduleUrl);
    if (moduleName === 'database' && !dbInit) {
      this.databaseCallback();
    }
    this.updateModuleHealth(moduleName, instancePeer);
    this.moduleRegister.emit('module-registered');
  }

  private registerAdminRoutes() {
    this.sdk.getAdmin().registerRoute(adminRoutes.getModulesRoute(this.registeredModules));
    this.sdk.getAdmin().registerRoute(adminRoutes.getGetConfigRoute(this.grpcSdk, this.registeredModules));
    this.sdk.getAdmin().registerRoute(adminRoutes.getUpdateConfigRoute(this.grpcSdk, this.sdk, this.registeredModules));
  }
}
