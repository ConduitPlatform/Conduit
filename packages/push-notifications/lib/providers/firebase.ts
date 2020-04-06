import { IPushNotifications } from '../interfaces/IPushNotifications';
import { IFirebaseSettings } from '../interfaces/IFirebaseSettings';
import * as firebase from 'firebase-admin';
import { ISendNotification, ISendNotificationToManyDevices } from '../interfaces/ISendNotification';
import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';

export class FirebaseProvider implements IPushNotifications {

  private readonly fcm: firebase.messaging.Messaging;

  constructor(settings: IFirebaseSettings) {
    const serviceAccount: firebase.ServiceAccount = {
      projectId: settings.projectId,
      privateKey: settings.privateKey.replace(/\\n/g, '\n'),
      clientEmail: settings.clientEmail
    };
    const firebaseOptions: firebase.AppOptions = {
      credential: firebase.credential.cert(serviceAccount)
    };

    this.fcm = firebase.initializeApp(firebaseOptions).messaging();
  }

  async sendToDevice(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any> {
    const params: ISendNotification = req.body;
    if (isNil(params)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    const { userId, type } = params;
    if (!isNil(type)) {
      // const user = await databaseAdapter.getSchema('User').findOne({ _id: userId });

      // TODO Do we need an option for disabled notifications in the user?
      // const disabled = user?.disabledNotifications?.find(notification => notification === type);
      // if (!isNil(disabled)) {
      //   return;
      // }
    }
    const notificationToken = await databaseAdapter.getSchema('NotificationToken').findOne({ userId });
    if (isNil(notificationToken)) {
      return res.status(404).json({error: 'Notification token not found'});
    }
    const { title, body, data } = params;
    const message: firebase.messaging.Message = {
      token: notificationToken.token,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        type: type ?? ''
      }
    };
    return this.fcm.send(message);

  }

  async sendMany(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any> {
    const params: ISendNotification[] = req.body;
    if (isNil(params)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    // TODO Logic
  }

  async sendToManyDevices(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any> {
    const params: ISendNotificationToManyDevices = req.body;
    if (isNil(params)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    // TODO Logic
  }
}
