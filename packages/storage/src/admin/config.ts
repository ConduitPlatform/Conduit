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

    const currentConfig = dbConfig.storage;

    const final = merge(currentConfig, newConfig);
    dbConfig.storage = final;
    const saved = await Config.findByIdAndUpdate(dbConfig);
    delete saved._id;
    delete saved.createdAt;
    delete saved.updatedAt;
    delete saved.__v;
    appConfig.load(saved);

    return res.json(saved.storage);
  }

  async getConfig(req: Request, res: Response) {
    const databaseAdapter = this.conduit.getDatabase();
    const Config = databaseAdapter.getSchema('Config');
    const dbConfig = await Config.findOne({});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }
    return res.json(dbConfig.storage);
  }
}
