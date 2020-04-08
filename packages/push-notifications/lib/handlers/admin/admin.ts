import { NextFunction, Request, Response } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from '../../interfaces/ISendNotification';
import { isNil } from 'lodash';

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

}

export async function editNotificationsConfig(req: Request, res: Response, next: NextFunction) {

}
