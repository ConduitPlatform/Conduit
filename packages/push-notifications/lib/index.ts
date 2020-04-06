import { IPushNotifications } from './interfaces/IPushNotifications';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { isNil } from 'lodash';
import { NotificationTokenModel } from './models/NotificationToken';
import { FirebaseProvider } from './providers/firebase';
import { Request, Response, NextFunction } from 'express';

class Application {
}

export class PushNotifications {

  private static _instance: PushNotifications;
  _provider: IPushNotifications;
  pushNotificationModel: any;

  private constructor(app: Application, name: string, settings: any) {
    const { conduit } = app as any;

    if (isNil(conduit)) {
      throw new Error('Conduit not initialized');
    }

    const { database } = conduit;

    const databaseAdapter = database.getDbAdapter();

    databaseAdapter.registerSchemas(NotificationTokenModel);

    this.pushNotificationModel = databaseAdapter.getSchema('NotificationToken');

    if (name === 'firebase') {
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    } else {
      // this was done just for now so that we surely initialize the _provider variable
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    }

    conduit.admin.registerRoute('POST', '/set-notification-token',
      (req: Request, res: Response, next: NextFunction) => this.setNotificationToken(req, res, next).catch(next));

    conduit.admin.registerRoute('GET', '/get-notification-token',
      (req: Request, res: Response, next: NextFunction) => this.getNotificationToken(req, res, next).catch(next));

    // Is the usage of the databaseAdapter below right???
    conduit.admin.registerRoute('POST', '/send-notification-to-device',
      (req: Request, res: Response, next: NextFunction) => this._provider.sendToDevice(req, res, next, databaseAdapter).catch(next));

    conduit.admin.registerRoute('POST', '/send-many-notifications',
      (req: Request, res: Response, next: NextFunction) => this._provider.sendMany(req, res, next, databaseAdapter).catch(next));

    conduit.admin.registerRoute('POST', '/send-notification-to-many-devices',
      (req: Request, res: Response, next: NextFunction) => this._provider.sendToManyDevices(req, res, next, databaseAdapter).catch(next));

    conduit.pushNotifications = this;
  }

  public static getInstance(app?: Application, name?: string, settings?: IFirebaseSettings) {
    if (!this._instance && name && settings && app) {
      this._instance = new PushNotifications(app, name, settings);
    } else if (this._instance) {
      return this._instance;
    } else {
      throw new Error('No settings provided to initialize');
    }
  }


  private async setNotificationToken(req: Request, res: Response, next: NextFunction) {
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

  private async getNotificationToken(req: Request, res: Response, next: NextFunction) {
    const userId = req.body.userId;
    if (isNil(userId)) {
      return res.status(401).json({ error: 'Required field, userId, is missing' });
    }

    const tokenDocument = await this.pushNotificationModel.findOne({ userId });

    return res.json({ tokenDocument });
  }
}
