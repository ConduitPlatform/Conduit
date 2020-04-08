import { IPushNotificationsProvider } from './interfaces/IPushNotificationsProvider';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { isNil } from 'lodash';
import { NotificationTokenModel } from './models/NotificationToken';
import { FirebaseProvider } from './providers/firebase';
import { Request, Response, NextFunction, Application } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from './interfaces/ISendNotification';
import { getNotificationToken, setNotificationToken } from './handlers/notification-tokens';

class PushNotificationsModule {

  private static _instance: PushNotificationsModule;
  _provider: IPushNotificationsProvider;
  pushNotificationModel: any;

  private constructor(app: Application, name: string, settings: any) {
    const { conduit } = app as any;

    if (isNil(conduit)) {
      throw new Error('Conduit not initialized');
    }

    const { database } = conduit;

    const databaseAdapter = database.getDbAdapter();

    databaseAdapter.createSchemaFromAdapter(NotificationTokenModel);

    this.pushNotificationModel = databaseAdapter.getSchema('NotificationToken');

    if (name === 'firebase') {
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    } else {
      // this was done just for now so that we surely initialize the _provider variable
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    }

    conduit.admin.registerRoute('POST', '/notification-token',
      (req: Request, res: Response, next: NextFunction) => setNotificationToken(req, res, next, this.pushNotificationModel).catch(next));

    conduit.admin.registerRoute('GET', '/notification-token/:userId',
      (req: Request, res: Response, next: NextFunction) => getNotificationToken(req, res, next, this.pushNotificationModel).catch(next));

    conduit.admin.registerRoute('POST', '/notifications/send',
      async (req: Request, res: Response, next: NextFunction) => {
      const params: ISendNotification = req.body;
      if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
      await this._provider.sendToDevice(params, databaseAdapter).catch(next);
      return res.json('ok');
    });

    conduit.admin.registerRoute('POST', '/notifications/send-many',
      async (req: Request, res: Response, next: NextFunction) => {
        const params: ISendNotification[] = req.body;
        if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
        await this._provider.sendMany(params, databaseAdapter).catch(next);
        return res.json('ok');
      });

    conduit.admin.registerRoute('POST', '/notifications/send-to-many-devices',
      async (req: Request, res: Response, next: NextFunction) => {
        const params: ISendNotificationToManyDevices = req.body;
        if (isNil(params)) return res.status(401).json({error: 'Required fields are missing'});
        await this._provider.sendToManyDevices(params, databaseAdapter).catch(next);
        return res.json('ok');
      });

    conduit.pushNotifications = this;
  }

  public static getInstance(app?: Application, name?: string, settings?: IFirebaseSettings) {
    if (!this._instance && name && settings && app) {
      this._instance = new PushNotificationsModule(app, name, settings);
    } else if (this._instance) {
      return this._instance;
    } else {
      throw new Error('No settings provided to initialize');
    }
  }



}

export = PushNotificationsModule;
