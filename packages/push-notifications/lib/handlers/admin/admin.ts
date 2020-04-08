import { NextFunction, Request, Response } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from '../../interfaces/ISendNotification';
import { isNil } from 'lodash';

export async function sendNotification(req: Request, res: Response, next: NextFunction, provider: any, databaseAdapter: any) {
  const params: ISendNotification = req.body;
  if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
  await provider.sendToDevice(params, databaseAdapter).catch(next);
  return res.json('ok');
}

export async function sendManyNotifications(req: Request, res: Response, next: NextFunction, provider: any, databaseAdapter: any) {
  const params: ISendNotification[] = req.body;
  if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
  await provider.sendMany(params, databaseAdapter).catch(next);
  return res.json('ok');
}

export async function sendToManyDevices(req: Request, res: Response, next: NextFunction, provider: any, databaseAdapter: any) {
  const params: ISendNotificationToManyDevices = req.body;
  if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
  await provider.sendToManyDevices(params, databaseAdapter).catch(next);
  return res.json('ok');
}
