import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';
import { ConduitSDK } from '@conduit/sdk';

export class AdminConfigHandlers {

  private readonly conduit: ConduitSDK;

  constructor(conduit: ConduitSDK) {
    this.conduit = conduit;
  }

  async editConfig(req: Request, res: Response) {
    const appConfig = (this.conduit as any).config;
    const databaseAdapter = this.conduit.getDatabase();

    const Config = databaseAdapter.getSchema('Config');

    const newConfig = req.body;
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }

    const currentConfig = dbConfig.config.storage;

    const final = merge(currentConfig, newConfig);
    dbConfig.config.storage = final;
    const saved = await Config.findByIdAndUpdate(dbConfig);

    appConfig.load(saved.config);

    return res.json(saved.config.storage);
  }

  async getConfig(req: Request, res: Response) {
    const { config } = this.conduit as any;

    const storageConfig = config.get('storage');

    return res.json(storageConfig);
  }
}
