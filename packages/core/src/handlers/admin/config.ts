import { ConduitSDK } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';
import { Config as ConvictConfig } from 'convict';

export class ConfigAdminHandlers {
  constructor(private readonly sdk: ConduitSDK) {
  }

  async getConfig(req: Request, res: Response) {
    const database = this.sdk.getDatabase();
    const Config = database.getSchema('Config');

    const appConfig = await Config.findOne({});
    if (isNil(appConfig)) {
      return res.json({});
    }

    return res.json(appConfig);
  }

  async setConfig(req: Request, res: Response) {
    const newConfig = req.body;

    const database = this.sdk.getDatabase();
    const Config = database.getSchema('Config');

    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }

    const appConfig = (this.sdk as any).config as ConvictConfig<any>;
    const currentConfig = appConfig.get();
    const final = merge(currentConfig, newConfig);

    dbConfig.config = final;
    const saved = await Config.findByIdAndUpdate(dbConfig);

    appConfig.load(saved);
    delete saved._id;
    delete saved.createdAt;
    delete saved.updatedAt;
    delete saved.__v;

    return res.json(saved);
  }
}
