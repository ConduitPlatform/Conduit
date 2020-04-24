import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, merge, isPlainObject } from 'lodash';
import { Config as ConvictConfig } from 'convict';
import AuthenticationModule from '@conduit/authentication';
import EmailModule from '@conduit/email';
import InMemoryStore from '@conduit/in-memory-store';
import PushNotificationsModule from '@conduit/push-notifications';
import StorageModule from '@conduit/storage';
import validator, { isEmpty } from 'validator';
import isNaturalNumber from 'is-natural-number';

export class ConfigAdminHandlers {
  private readonly database: IConduitDatabase;

  constructor(private readonly sdk: ConduitSDK) {
    this.database = sdk.getDatabase();
  }

  async getConfig(req: Request, res: Response) {
    const Config = this.database.getSchema('Config');

    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.json({});
    }

    let finalConfig: any;
    const module = req.params.module;

    switch (module) {
      case undefined:
        finalConfig = dbConfig;
        delete finalConfig._id;
        delete finalConfig.createdAt;
        delete finalConfig.updatedAt;
        delete finalConfig.__v;
        break;
      case 'authentication':
        finalConfig = dbConfig.authentication;
        break;
      case 'email':
        finalConfig = dbConfig.email;
        break;
      case 'storage':
        finalConfig = dbConfig.storage;
        break;
      case 'push-notifications':
        finalConfig = dbConfig.pushNotifications;
        break;
      case 'in-memory-store':
        finalConfig = dbConfig.inMemoryStore;
        break;
      default:
        return res.status(403).json({ error: 'Invalid module name' });
    }

    if (isEmpty(finalConfig)) return res.json({active: false});
    return res.json(finalConfig);
  }

  async setConfig(req: Request, res: Response) {
    const Config = this.database.getSchema('Config');
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }
    const appConfig = (this.sdk as any).config as ConvictConfig<any>;

    const newConfig = req.body;
    const moduleName = req.params.module;
    let module: any;
    let currentConfig: any;
    let configProperty: string;
    let configSchema: any;

    switch (moduleName) {
      case undefined:
        currentConfig = dbConfig;
        break;
      case 'authentication':
        currentConfig = dbConfig.authentication;
        module = this.sdk.getAuthentication();
        configProperty = 'authentication';
        configSchema = AuthenticationModule.config.authentication;
        break;
      case 'email':
        currentConfig = dbConfig.email;
        module = this.sdk.getEmail();
        configProperty = 'email';
        configSchema = EmailModule.config.email;
        break;
      case 'in-memory-store':
        currentConfig = dbConfig.inMemoryStore;
        module = this.sdk.getInMemoryStore();
        configProperty = 'inMemoryStore';
        configSchema = InMemoryStore.config.inMemoryStore;
        break;
      case 'push-notifications':
        currentConfig = dbConfig.pushNotifications;
        module = this.sdk.getPushNotifications();
        configProperty = 'pushNotifications';
        configSchema = PushNotificationsModule.config.pushNotifications;
        break;
      case 'storage':
        currentConfig = dbConfig.storage;
        module = this.sdk.getStorage();
        configProperty = 'storage';
        configSchema = StorageModule.config.storage;
        break;
      default:
        return res.status(403).json({ error: 'Invalid module name' });
    }

    // Validate here
    if (newConfig.active === false) return res.status(403).json({error: 'Modules cannot be deactivated'});
    if (!isNil(module) && !this.validateConfig(newConfig, configSchema)) { // General config doesn't get validated
      return res.status(403).json({ error: 'Invalid configuration values' });
    }

    if (isNil(currentConfig)) currentConfig = {};
    const final = merge(currentConfig, newConfig);
    if (isNil(module)){
      Object.assign(dbConfig, final);
    } else {
      if (isNil(dbConfig[configProperty!])) dbConfig[configProperty!] = {};
      Object.assign(dbConfig[configProperty!], final);
    }
    const saved = await Config.findByIdAndUpdate(dbConfig);
    delete saved._id;
    delete saved.createdAt;
    delete saved.updatedAt;
    delete saved.__v;
    appConfig.load(saved);

    // Enable module here

    if (module) {
      const initiated = await module.initModule();
      if (!initiated.result) {
        return res.status(403).json({ message: 'Invalid configuration settings', error: initiated.error.message });
      }
    }

    if (isNil(module)) return res.json(saved);
    return res.json(saved[configProperty!]);
  }

  // this validator doesn't support custom convict types
  private validateConfig(configInput: any, configSchema: any): Boolean {
    if (isNil(configInput)) return false;

    return Object.keys(configInput).every(key => {
      if (configSchema.hasOwnProperty(key)) {
        if (isPlainObject(configInput[key])) {
          return this.validateConfig(configInput[key], configSchema[key])
        } else if (configSchema[key].hasOwnProperty('format')) {

          const format = configSchema[key].format.toLowerCase();
          if (typeof configInput[key] === format || format === '*') return true;
          if (format === 'int' && validator.isInt(configInput[key])) return true;
          if (format === 'port' && validator.isPort(configInput[key])) return true;
          if (format === 'url' && validator.isURL(configInput[key])) return true;
          if (format === 'email' && validator.isEmail(configInput[key])) return true;
          if (format === 'ipaddress' && validator.isIP(configInput[key])) return true;
          if (format === 'timestamp' && ((new Date(configInput[key])).getTime() > 0)) return true;
          if (format === 'nat' && isNaturalNumber(configInput[key])) return true;
          if (format === 'duration' && isNaturalNumber(configInput[key])) return true;
        }
      }
      return false;
    });
  }
}
