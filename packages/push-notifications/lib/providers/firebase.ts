import { IPushNotifications } from '../interfaces/IPushNotifications';
import { IFirebaseSettings } from '../interfaces/IFirebaseSettings';
import * as firebase from 'firebase-admin';
import { ISendNotification, ISendNotificationToManyDevices } from '../interfaces/ISendNotification';
import { NextFunction, Request, Response } from 'express';
import { isNil, keyBy, isEmpty } from 'lodash';

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
      return res.status(404).json({ error: 'Notification token not found' });
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
    await this.fcm.send(message);
    return res.json({ message: 'Notification sent' });
  }

  async sendMany(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any> {
    const params: ISendNotification[] = req.body;
    if (isNil(params)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }

    const userIds = params.map(param => param.userId);
    const notificationsObj = keyBy(params, param => param.userId);

    // const users = await databaseAdapter.getSchema('User').find({ _id: { $in: userIds } });

    // const allowed = users.reduce<string[]>((filtered: any, user: any) => {
    //   const notificationType = notificationsObj[user._id.toString()].type;
    //
    //   if (_.isNil(notificationType)) {
    //     filtered.push(user._id.toString());
    //     return filtered;
    //   }
    //
    //   const ignored = user.disabledNotifications.find((notification: any) => notificationType === notification);
    //   if (_.isNil(ignored)) filtered.push(user._id.toString());
    //
    //   return filtered;
    // }, []);

    const notificationTokens = await databaseAdapter.getSchema('NotificationToken').find({ userId: { $in: userIds } }); // or allowed

    const promises = notificationTokens.map(async (token: any) => {
      const id = token.userId.toString();
      const data = notificationsObj[id];

      const message: firebase.messaging.Message = {
        notification: {
          title: data.title,
          body: data.body
        },
        data: {
          ...data.data,
          type: data.type ?? ''
        },
        token: token.token
      };

      await this.fcm.send(message).catch(console.error);
    });
    await Promise.all(promises);
    return res.json({ message: 'Notifications sent' });
  }

  async sendToManyDevices(req: Request, res: Response, next: NextFunction, databaseAdapter: any): Promise<any> {
    const params: ISendNotificationToManyDevices = req.body;
    if (isNil(params)) {
      return res.status(401).json({ error: 'Required fields are missing' });
    }


    // let enabledIds = params.userIds;
    // if (!isNil(params.type)) {
    //   const users = await databaseAdapter.getSchema('User').find({ _id: { $in: params.userIds } });
    //
    //   enabledIds = [];
    //
    //   users.forEach((user: any) => {
    //     const disabled = user?.disabledNotifications?.find((notification: string) => notification === params.type);
    //     if (isNil(disabled)) {
    //       enabledIds.push(user._id.toString());
    //     }
    //   });
    // }
    //
    // if (isEmpty(enabledIds)) return;
    const notificationTokens = await databaseAdapter.getSchema('NotificationToken').find({ userId: { $in: params.userIds } }); // or enabled ids
    if (notificationTokens.length === 0) return;

    const promises = notificationTokens.map(async (notToken: any) => {
      const message: firebase.messaging.Message = {
        token: notToken.token,
        notification: {
          title: params.title,
          body: params.body
        },
        data: {
          ...params.data,
          type: params.type ?? ''
        }
      };
      await this.fcm.send(message);
    });
    await Promise.all(promises);
    return res.json({ message: 'Notifications sent' });
  }
}
