import { IPushNotificationsProvider } from './interfaces/IPushNotificationsProvider';
import { IFirebaseSettings } from './interfaces/IFirebaseSettings';
import { isNil } from 'lodash';
import { NotificationTokenModel } from './models/NotificationToken';
import { FirebaseProvider } from './providers/firebase';
import { Request, Response, NextFunction, Application } from 'express';
import { ISendNotification, ISendNotificationToManyDevices } from './interfaces/ISendNotification';
import {
  configureNotificationTokenVars,
  getNotificationToken,
  setNotificationToken
} from './handlers/notification-tokens/notification-tokens';
import {
  configureAdminVars,
  editNotificationsConfig,
  getNotificationsConfig,
  sendManyNotifications,
  sendNotification,
  sendToManyDevices
} from './handlers/admin/admin';

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

    configureNotificationTokenVars(this.pushNotificationModel);
    configureAdminVars(this._provider, databaseAdapter);

    conduit.admin.registerRoute('POST', '/notification-token',
      (req: Request, res: Response, next: NextFunction) => setNotificationToken(req, res, next).catch(next));

    conduit.admin.registerRoute('GET', '/notification-token/:userId',
      (req: Request, res: Response, next: NextFunction) => getNotificationToken(req, res, next).catch(next));

    conduit.admin.registerRoute('POST', '/notifications/send',
      (req: Request, res: Response, next: NextFunction) => sendNotification(req, res, next).catch(next));

    conduit.admin.registerRoute('POST', '/notifications/send-many',
      (req: Request, res: Response, next: NextFunction) => sendManyNotifications(req, res, next).catch(next));

    conduit.admin.registerRoute('POST', '/notifications/send-to-many-devices',
      (req: Request, res: Response, next: NextFunction) => sendToManyDevices(req, res, next).catch(next));

    conduit.admin.registerRoute('GET', '/notifications/config',
      (req: Request, res: Response, next: NextFunction) => getNotificationsConfig(req, res, next).catch(next));

    conduit.admin.registerRoute('PUT', '/notifications/config',
      (req: Request, res: Response, next: NextFunction) => editNotificationsConfig(req, res, next).catch(next));


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
