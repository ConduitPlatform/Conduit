import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';

let pushNotificationModel: any;

export function configureNotificationTokenVars(model: any) {
  pushNotificationModel = model;
}

export async function setNotificationToken(req: Request, res: Response, next: NextFunction) {
  const { userId, token, platform } = req.body;
  if (isNil(userId) || isNil(token) || isNil(platform)) {
    return res.status(401).json({ error: 'Required fields are missing' });
  }

  const newTokenDocument = await pushNotificationModel.create({
    userId,
    token,
    platform
  });

  return res.json({ message: 'Push notification token created', newTokenDocument });
}

export async function getNotificationToken(req: Request, res: Response, next: NextFunction) {
  const userId = req.params.userId;
  if (isNil(userId)) {
    return res.status(401).json({ error: 'User id parameter was not provided' });
  }

  const tokenDocument = await pushNotificationModel.findOne({ userId });

  return res.json({ tokenDocument });
}
