import { IPushNotificationsProvider } from './interfaces/IPushNotificationsProvider';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { NotificationTokenModel } from './models/NotificationToken';
import { FirebaseProvider } from './providers/firebase';
import { NextFunction, Request, Response } from 'express';
import { NotificationTokensHandler } from './handlers/notification-tokens/notification-tokens';
import { AdminHandler } from './handlers/admin/admin';
import { ConduitSDK, IConduitPushNotifications } from '@conduit/sdk';

class PushNotificationsModule extends IConduitPushNotifications {

  private readonly _provider: IPushNotificationsProvider;
  pushNotificationModel: any;

  constructor(conduit: ConduitSDK, name: string, settings: any) {
    super(conduit);

    const databaseAdapter = conduit.getDatabase();

    databaseAdapter.createSchemaFromAdapter(NotificationTokenModel);

    this.pushNotificationModel = databaseAdapter.getSchema('NotificationToken');

    if (name === 'firebase') {
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    } else {
      // this was done just for now so that we surely initialize the _provider variable
      this._provider = new FirebaseProvider(settings as IFirebaseSettings);
    }

    const notificationTokensHandler = new NotificationTokensHandler(this.pushNotificationModel);
    const adminHandler = new AdminHandler(this._provider, databaseAdapter);

    conduit.getAdmin().registerRoute('POST', '/notification-token',
      (req: Request, res: Response, next: NextFunction) => notificationTokensHandler.setNotificationToken(req, res, next).catch(next));

    conduit.getAdmin().registerRoute('GET', '/notification-token/:userId',
      (req: Request, res: Response, next: NextFunction) => notificationTokensHandler.getNotificationToken(req, res, next).catch(next));

    conduit.getAdmin().registerRoute('POST', '/notifications/send',
      (req: Request, res: Response, next: NextFunction) => adminHandler.sendNotification(req, res, next).catch(next));

    conduit.getAdmin().registerRoute('POST', '/notifications/send-many',
      (req: Request, res: Response, next: NextFunction) => adminHandler.sendManyNotifications(req, res, next).catch(next));

    conduit.getAdmin().registerRoute('POST', '/notifications/send-to-many-devices',
      (req: Request, res: Response, next: NextFunction) => adminHandler.sendToManyDevices(req, res, next).catch(next));

    conduit.getAdmin().registerRoute('GET', '/notifications/config',
      (req: Request, res: Response, next: NextFunction) => adminHandler.getNotificationsConfig(req, res, next).catch(next));

    conduit.getAdmin().registerRoute('PUT', '/notifications/config',
      (req: Request, res: Response, next: NextFunction) => adminHandler.editNotificationsConfig(req, res, next).catch(next));

  }
}

export = PushNotificationsModule;
