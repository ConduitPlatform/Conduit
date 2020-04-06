import { IPushNotificationsProvider } from '../interfaces/IPushNotificationsProvider';
import { IFirebaseSettings } from '../interfaces/IFirebaseSettings';
import * as firebase from 'firebase-admin';
import { ISendNotification, ISendNotificationToManyDevices } from '../interfaces/ISendNotification';
import { isNil, keyBy } from 'lodash';

export class FirebaseProvider implements IPushNotificationsProvider {

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

  // TODO check for disabled notifications for users

  async sendToDevice(params: ISendNotification, databaseAdapter: any): Promise<any> {

    const { userId, type } = params;
    if (isNil(userId)) return;

    const notificationToken = await databaseAdapter.getSchema('NotificationToken').findOne({ userId });
    if (isNil(notificationToken)) {
      return;
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

  async sendMany(params: ISendNotification[], databaseAdapter: any): Promise<any> {

    const userIds = params.map(param => param.userId);
    const notificationsObj = keyBy(params, param => param.userId);

    const notificationTokens = await databaseAdapter.getSchema('NotificationToken').find({ userId: { $in: userIds } });

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
    return Promise.all(promises);
  }

  async sendToManyDevices(params: ISendNotificationToManyDevices, databaseAdapter: any): Promise<any> {

    const notificationTokens = await databaseAdapter.getSchema('NotificationToken').find({ userId: { $in: params.userIds } });
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
    return Promise.all(promises);
  }
}
