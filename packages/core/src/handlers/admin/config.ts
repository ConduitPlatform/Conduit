import { ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';
import { Config as ConvictConfig } from 'convict';

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

    switch (moduleName) {
      case undefined:
        currentConfig = dbConfig;
        break;
      case 'email':
        currentConfig = dbConfig.email;
        module = this.sdk.getEmail();
        configProperty = 'email';
        break;
      case 'in-memory-store':
        currentConfig = dbConfig.inMemoryStore;
        module = this.sdk.getInMemoryStore();
        configProperty = 'inMemoryStore';
        break;
      case 'storage':
        currentConfig = dbConfig.storage;
        module = this.sdk.getStorage();
        configProperty = 'storage';
        break;``
      default:
        return res.status(403).json({ error: 'Invalid module name' });
    }

    // Validate here
    if (!isNil(module) && !module.validateConfig(newConfig)) { // General config doesn't get validated
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
    if (module && ! await module.initModule()) {
      return res.status(403).json({ error: 'Invalid configuration settings' });
    }

    if (isNil(module)) return res.json(saved);
    return res.json(saved[configProperty!]);
  }
}
