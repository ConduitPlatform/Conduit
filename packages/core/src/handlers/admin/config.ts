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
}

//   async setConfig(req: Request, res: Response) {
//     const newConfig = req.body;
//
//     const Config = this.database.getSchema('Config');
//
//     const dbConfig = await Config.findOne({});
//     if (isNil(dbConfig)) {
//       return res.status(404).json({ error: 'Config not set' });
//     }
//
//     const appConfig = (this.sdk as any).config as ConvictConfig<any>;
//     const currentConfig = appConfig.get();
//     const final = merge(currentConfig, newConfig);
//
//     Object.assign(dbConfig, final);
//     const saved = await Config.findByIdAndUpdate(dbConfig);
//     delete saved._id;
//     delete saved.createdAt;
//     delete saved.updatedAt;
//     delete saved.__v;
//
//     appConfig.load(saved);
//
//     return res.json(saved);
//   }
//
//   async editInMemoryStoreConfig(req: Request, res: Response) {
//     const Config = this.database.getSchema('Config');
//     const appConfig = (this.sdk as any).config;
//     const newInMemoryStoreConfig = req.body;
//     if (!isNil(newInMemoryStoreConfig.active)) {
//       delete newInMemoryStoreConfig.active;
//     }
//
//     const dbConfig = await Config.findOne({});
//     if (isNil(dbConfig)) {
//       return res.status(404).json({ error: 'Config not set' });
//     }
//
//
//     if (!this.sdk.getInMemoryStore().validateConfig(newInMemoryStoreConfig)) {
//       return res.status(403).json({error: 'Invalid Configuration given'});
//     }
//
//     const final = merge(currentInMemoryStoreConfig, newInMemoryStoreConfig);
//     dbConfig.inMemoryStore = final;
//     const saved = await Config.findByIdAndUpdate(dbConfig);
//     delete saved._id;
//     delete saved.createdAt;
//     delete saved.updatedAt;
//     delete saved.__v;
//     await appConfig.load(saved);
//
//
//
//     return res.json(saved.email);
//   }
// }
