import { Application } from "express";
import { IConduitRouter } from "./modules/Router/interfaces";
import { IConduitDatabase } from "./modules/Database/interfaces";
import { IConduitAdmin } from "./modules/Admin";
import { IConduitEmail } from "./modules/Email";
import { IConduitPushNotifications } from "./modules/PushNotifications";
import { IConduitInMemoryStore } from "./modules/InMemoryStore";
import { IConduitStorage } from "./modules/Storage";
import { IConduitSecurity } from "./modules/Security";
import { IConduitAuthentication } from "./modules/Authentication";
import { IConduitCMS } from "./modules/Cms";
import { isNil, isPlainObject, merge } from "lodash";
import validator from "validator";
import isNaturalNumber from "is-natural-number";
import { Config as ConvictConfig } from "convict";
import { IConfigManager } from "./modules/Config";
import { StateManager } from "./utilities/StateManager";
import { RedisManager } from "./utilities/RedisManager";
import { EventBus } from "./utilities/EventBus";
import Crypto from "crypto";

export class ConduitSDK {
  private static _instance: ConduitSDK;
  private _app: Application;
  private _router?: IConduitRouter;
  private _database?: IConduitDatabase;
  private _admin?: IConduitAdmin;
  private _email?: IConduitEmail;
  private _pushNotifications?: IConduitPushNotifications;
  private _inMemoryStore?: IConduitInMemoryStore;
  private _storage?: IConduitStorage;
  private _security?: IConduitSecurity;
  private _authentication?: IConduitAuthentication;
  private _cms?: IConduitCMS;
  private _configManager?: IConfigManager;
  private _eventBus: EventBus;
  private _stateManager: StateManager;
  private readonly name: string;

  private constructor(app: Application, name?: string) {
    this._app = app;
    if (!name) {
      this.name = "corepackage_" + Crypto.randomBytes(16).toString("hex");
    } else {
      this.name = name;
    }
    if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
      let redisManager = new RedisManager(process.env.REDIS_HOST, process.env.REDIS_PORT);
      this._eventBus = new EventBus(redisManager);
      this._stateManager = new StateManager(redisManager, this.name);
    } else {
      console.error("Redis IP not defined");
      process.exit(-1);
    }
  }

  registerRouter(router: IConduitRouter) {
    if (this._router) throw new Error("Cannot register a second router!");
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
    throw new Error("Router not assigned yet!");
  }

  registerDatabase(database: IConduitDatabase) {
    if (this._database) throw new Error("Cannot register a second database!");
    this._database = database;
  }

  getDatabase(): IConduitDatabase {
    if (this._database) return this._database;
    throw new Error("Database not assigned yet!");
  }

  registerCMS(cms: IConduitCMS) {
    if (this._cms) throw new Error("Cannot register a second CMS!");
    this._cms = cms;
  }

  getCMS(): IConduitCMS {
    if (this._cms) return this._cms;
    throw new Error("CMS not assigned yet!");
  }

  registerAdmin(admin: IConduitAdmin) {
    if (this._admin) throw new Error("Cannot register a second admin!");
    this._admin = admin;
  }

  getAdmin(): IConduitAdmin {
    if (this._admin) return this._admin;
    throw new Error("Admin not assigned yet!");
  }

  registerEmail(email: IConduitEmail) {
    this._email = email;
  }

  getEmail() {
    if (this._email) return this._email;
    throw new Error("Email module not assigned yet!");
  }

  registerPushNotifications(pushNotifications: IConduitPushNotifications) {
    if (this._pushNotifications) throw new Error("Cannot register a second push notifications module");
    this._pushNotifications = pushNotifications;
  }

  // TODO is this needed?
  getPushNotifications(): IConduitPushNotifications {
    if (this._pushNotifications) return this._pushNotifications;
    throw new Error("Push notifications not assigned yet!");
  }

  registerInMemoryStore(inMemoryStore: IConduitInMemoryStore) {
    if (this._inMemoryStore) throw new Error("Cannot register a second in-memory-store module");
    this._inMemoryStore = inMemoryStore;
  }

  getInMemoryStore(): IConduitInMemoryStore {
    if (this._inMemoryStore) return this._inMemoryStore;
    throw new Error("In-memory-store module not assigned yet");
  }

  registerStorage(storage: IConduitStorage) {
    if (this._storage) throw new Error("Cannot register a second storage module");
    this._storage = storage;
  }

  getStorage(): IConduitStorage {
    if (this._storage) return this._storage;
    throw new Error("Storage module not assigned yet");
  }

  registerSecurity(security: IConduitSecurity) {
    if (this._security) throw new Error("Cannot register a second security module");
    this._security = security;
  }

  getSecurity(): IConduitSecurity {
    if (this._security) return this._security;
    throw new Error("Security module not assigned yet");
  }

  registerAuthentication(authentication: IConduitAuthentication) {
    if (this._authentication) throw new Error("Cannot register a second authentication module");
    this._authentication = authentication;
  }

  getAuthentication(): IConduitAuthentication {
    if (this._authentication) return this._authentication;
    throw new Error("Authentication module not assigned yet");
  }

  registerConfigManager(configManager: IConfigManager) {
    if (this._configManager) throw new Error("Cannot register a second config manager");
    this._configManager = configManager;
  }

  getConfigManager(): IConfigManager {
    if (this._configManager) return this._configManager;
    throw new Error("Config manager not assigned yet");
  }

  static getInstance(app: Application) {
    if (!this._instance && !app) throw new Error("No settings provided to initialize");
    if (!this._instance) {
      this._instance = new ConduitSDK(app);
    }
    return this._instance;
  }

  async updateConfig(newConfig: any, moduleName?: string) {
    const Config = this.getDatabase().getSchema("Config");
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      throw new Error("Config not set");
    }
    const appConfig = (this as any).config as ConvictConfig<any>;
    let currentConfig: any;
    if (isNil(moduleName)) {
      currentConfig = dbConfig;
    } else {
      currentConfig = dbConfig[moduleName];
    }

    if (isNil(currentConfig)) currentConfig = {};
    const final = merge(currentConfig, newConfig);
    if (isNil(moduleName)) {
      Object.assign(dbConfig, final);
    } else {
      if (isNil(dbConfig[moduleName])) dbConfig[moduleName] = {};
      Object.assign(dbConfig[moduleName], final);
    }
    const saved = await Config.findByIdAndUpdate(dbConfig._id, dbConfig);
    delete saved._id;
    delete saved.createdAt;
    delete saved.updatedAt;
    delete saved.__v;
    appConfig.load(saved);

    if (isNil(moduleName)) {
      return saved;
    } else {
      return saved[moduleName];
    }
  }

  async addFieldstoConfig(newConfig: any, moduleName?: string) {
    const Config = this.getDatabase().getSchema("Config");
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      throw new Error("Config not set");
    }
    const appConfig = (this as any).config as ConvictConfig<any>;
    let currentConfig: any;
    if (isNil(moduleName)) {
      currentConfig = dbConfig;
    } else {
      currentConfig = dbConfig[moduleName];
    }
    if (isNil(currentConfig)) currentConfig = {};

    // keep only new keys
    const final = { ...newConfig, ...currentConfig };

    if (isNil(moduleName)) {
      Object.assign(dbConfig, final);
    } else {
      if (isNil(dbConfig[moduleName])) dbConfig[moduleName] = {};
      Object.assign(dbConfig[moduleName], final);
    }
    const saved = await Config.findByIdAndUpdate(dbConfig._id, dbConfig);
    delete saved._id;
    delete saved.createdAt;
    delete saved.updatedAt;
    delete saved.__v;
    appConfig.load(saved);

    if (isNil(moduleName)) {
      return saved;
    } else {
      return saved[moduleName];
    }
  }

  // this validator doesn't support custom convict types
  static validateConfig(configInput: any, configSchema: any): Boolean {
    if (isNil(configInput)) return false;

    return Object.keys(configInput).every((key) => {
      if (configSchema.hasOwnProperty(key)) {
        if (isPlainObject(configInput[key])) {
          return this.validateConfig(configInput[key], configSchema[key]);
        } else if (configSchema[key].hasOwnProperty("format")) {
          const format = configSchema[key].format.toLowerCase();
          if (typeof configInput[key] === format || format === "*") return true;
          if (format === "int" && validator.isInt(configInput[key])) return true;
          if (format === "port" && validator.isPort(configInput[key])) return true;
          if (format === "url" && validator.isURL(configInput[key])) return true;
          if (format === "email" && validator.isEmail(configInput[key])) return true;
          if (format === "ipaddress" && validator.isIP(configInput[key])) return true;
          if (format === "timestamp" && new Date(configInput[key]).getTime() > 0) return true;
          if (format === "nat" && isNaturalNumber(configInput[key])) return true;
          if (format === "duration" && isNaturalNumber(configInput[key])) return true;
        }
      }
      return false;
    });
  }
}

export * from "./models";
export * from "./interfaces";
export * from "./modules";
export * from "./helpers";
export * from "./constants";
