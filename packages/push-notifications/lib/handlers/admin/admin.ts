import { NextFunction, Request, Response } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from '../../interfaces/ISendNotification';
import { isNil, merge } from 'lodash';

let provider: any;
let databaseAdapter: any;

export function configureAdminVars(providerParam: any, databaseAdapterParam: any) {
  provider = providerParam;
  databaseAdapter = databaseAdapterParam;
}

export async function sendNotification(req: Request, res: Response, next: NextFunction) {
  const params: ISendNotification = req.body;
  if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
  await provider.sendToDevice(params, databaseAdapter).catch(next);
  return res.json('ok');
}

export async function sendManyNotifications(req: Request, res: Response, next: NextFunction) {
  const params: ISendNotification[] = req.body;
  if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
  await provider.sendMany(params, databaseAdapter).catch(next);
  return res.json('ok');
}

export async function sendToManyDevices(req: Request, res: Response, next: NextFunction) {
  const params: ISendNotificationToManyDevices = req.body;
  if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
  await provider.sendToManyDevices(params, databaseAdapter).catch(next);
  return res.json('ok');
}

export async function getNotificationsConfig(req: Request, res: Response, next: NextFunction) {
  const { conduit } = (req.app as any);
  const { config: appConfig } = conduit;

  const Config = databaseAdapter.getSchema('Config');
  const dbConfig = await Config.findOne({});
  if (isNil(dbConfig)) {
    return res.status(404).json({ error: 'Config not set' });
  }
  return res.json(dbConfig.config.pushNotifications);
}

export async function editNotificationsConfig(req: Request, res: Response, next: NextFunction) {
  const { conduit } = (req.app as any);
  const { config: appConfig } = conduit;

  const Config = databaseAdapter.getSchema('Config');

  const newNotificationsConfig = req.body;

  const dbConfig = await Config.findOne({});
  if (isNil(dbConfig)) {
    return res.status(404).json({ error: 'Config not set' });
  }

  const currentNotificationsConfig = dbConfig.config.pushNotifications;
  const final = merge(currentNotificationsConfig, newNotificationsConfig);

  dbConfig.config.pushNotifications = final;
  const saved = await dbConfig.save();
  await appConfig.load(saved.config);

  return res.json(saved.config.pushNotifications);
}
