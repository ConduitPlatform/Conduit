import {
  IConduitCore,
  IConduitAdmin,
  IConduitRouter,
  IConduitSecurity,
} from './modules';
import { isNil, isPlainObject } from 'lodash';
import validator from 'validator';
import isNaturalNumber from 'is-natural-number';
import { IConfigManager } from './modules';
import { StateManager } from './utilities/StateManager';
import { RedisManager } from './utilities/RedisManager';
import { EventBus } from './utilities/EventBus';

export class ConduitCommons {
  private static _instance: ConduitCommons;
  private _core?: IConduitCore;
  private _router?: IConduitRouter;
  private _admin?: IConduitAdmin;
  private _security?: IConduitSecurity;
  private _configManager?: IConfigManager;
  private readonly _eventBus: EventBus;
  private readonly _stateManager: StateManager;
  private readonly name: string;

  private constructor(name: string) {
    this.name = name;
    if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
      let redisManager = new RedisManager(process.env.REDIS_HOST, process.env.REDIS_PORT);
      this._eventBus = new EventBus(redisManager);
      this._stateManager = new StateManager(redisManager, this.name);
    } else {
      console.error('Redis IP not defined');
      process.exit(-1);
    }
  }

  registerCore(core: IConduitCore) {
    if (this._core) throw new Error('Cannot register a second core!');
    this._core = core;
  }

  getCore() {
    if (this._core) return this._core;
    throw new Error('Core not assigned yet!');
  }

  registerRouter(router: IConduitRouter) {
    if (this._router) throw new Error('Cannot register a second router!');
    this._router = router;
  }

  getBus(): EventBus {
    return this._eventBus;
  }

  getState(): StateManager {
    return this._stateManager;
  }

  getRouter(): IConduitRouter {
    if (this._router) return this._router;
    throw new Error('Router not assigned yet!');
  }

  registerAdmin(admin: IConduitAdmin) {
    if (this._admin) throw new Error('Cannot register a second admin!');
    this._admin = admin;
  }

  getAdmin(): IConduitAdmin {
    if (this._admin) return this._admin;
    throw new Error('Admin not assigned yet!');
  }

  registerSecurity(security: IConduitSecurity) {
    if (this._security) throw new Error('Cannot register a second security module');
    this._security = security;
  }

  getSecurity(): IConduitSecurity {
    if (this._security) return this._security;
    throw new Error('Security module not assigned yet');
  }

  registerConfigManager(configManager: IConfigManager) {
    if (this._configManager) throw new Error('Cannot register a second config manager');
    this._configManager = configManager;
  }

  getConfigManager(): IConfigManager {
    if (this._configManager) return this._configManager;
    throw new Error('Config manager not assigned yet');
  }

  static getInstance(name: string) {
    if (!this._instance) {
      this._instance = new ConduitCommons(name);
    }
    return this._instance;
  }

  // this validator doesn't support custom convict types
  static validateConfig(configInput: any, configSchema: any): Boolean {
    if (isNil(configInput)) return false;

    return Object.keys(configInput).every((key) => {
      if (configSchema.hasOwnProperty(key)) {
        if (isPlainObject(configInput[key])) {
          return this.validateConfig(configInput[key], configSchema[key]);
        } else if (configSchema[key].hasOwnProperty('format')) {
          const format = configSchema[key].format.toLowerCase();
          if (typeof configInput[key] === format || format === '*') return true;
          if (format === 'int' && validator.isInt(configInput[key])) return true;
          if (format === 'port' && validator.isPort(configInput[key])) return true;
          if (format === 'url' && validator.isURL(configInput[key])) return true;
          if (format === 'email' && validator.isEmail(configInput[key])) return true;
          if (format === 'ipaddress' && validator.isIP(configInput[key])) return true;
          if (format === 'timestamp' && new Date(configInput[key]).getTime() > 0)
            return true;
          if (format === 'nat' && isNaturalNumber(configInput[key])) return true;
          if (format === 'duration' && isNaturalNumber(configInput[key])) return true;
        }
      }
      return false;
    });
  }
}

export * from './models';
export * from './interfaces';
export * from './modules';
export * from './helpers';
export * from './constants';
export * from './utilities';
