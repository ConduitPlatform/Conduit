import { Request, Response } from 'express';
import { isNil, merge } from 'lodash';

export async function editConfig(req: Request, res: Response) {
  const database = (req.app as any).conduit.database;
  const appConfig = (req.app as any).conduit.config;
  const databaseAdapter = database.getDbAdapter();

  const Config = databaseAdapter.getSchema('Config');

  const newConfig = req.body;
  const dbConfig = await Config.findOne({});
  if (isNil(dbConfig)) {
    return res.status(404).json({ error: 'Config not set' });
  }

  const currentConfig = dbConfig.config.storage;

  const final = merge(currentConfig, newConfig);
  dbConfig.config.storage = final;
  const saved = await dbConfig.save();

  appConfig.load(saved.config);

  return res.json(saved.config.storage);
}
