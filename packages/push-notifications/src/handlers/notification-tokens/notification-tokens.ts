import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { ConduitSDK } from '@conduit/sdk';

export class NotificationTokensHandler {
  private readonly pushNotificationModel: any;

  constructor(conduit: ConduitSDK) {
    const databaseAdapter = conduit.getDatabase();
    this.pushNotificationModel = databaseAdapter.getSchema('NotificationToken');
  }

  async setNotificationToken(req: Request, res: Response, next: NextFunction) {
    const { userId, token, platform } = req.body;
    if (isNil(userId) || isNil(token) || isNil(platform)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    const newTokenDocument = await this.pushNotificationModel.create({
      userId,
      token,
      platform
    });

    return res.json({ message: 'Push notification token created', newTokenDocument });
  }

  async getNotificationToken(req: Request, res: Response, next: NextFunction) {
    const userId = req.params.userId;
    if (isNil(userId)) {
      return res.status(401).json({ error: 'User id parameter was not provided' });
    }

    const tokenDocument = await this.pushNotificationModel.findOne({ userId });

    return res.json({ tokenDocument });
  }
}
