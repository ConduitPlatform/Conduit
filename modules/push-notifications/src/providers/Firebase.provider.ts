import { IPushNotificationsProvider } from '../interfaces/IPushNotificationsProvider';
import { IFirebaseSettings } from '../interfaces/IFirebaseSettings';
import * as firebase from 'firebase-admin';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification';
import { isNil, keyBy } from 'lodash';
import { NotificationToken } from '../models';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class FirebaseProvider implements IPushNotificationsProvider {
  private fcm?: firebase.messaging.Messaging;
  private _initialized: boolean = false;

  constructor(settings: IFirebaseSettings) {
    this.updateProvider(settings);
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  updateProvider(settings: IFirebaseSettings) {
    const serviceAccount: firebase.ServiceAccount = {
      projectId: settings.projectId,
      privateKey: settings.privateKey.replace(/\\n/g, '\n'),
      clientEmail: settings.clientEmail,
    };
    try {
      this.fcm = firebase.app(serviceAccount.projectId).messaging();
      this._initialized = true;
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error('Failed to initialize Firebase: method 1');
    }
    try {
      this.fcm = firebase
        .initializeApp(
          {
            credential: firebase.credential.cert(serviceAccount),
          },
          serviceAccount.projectId,
        )
        .messaging();
      this._initialized = true;
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error('Failed to initialize Firebase: method 2');
    }
  }

  // TODO check for disabled notifications for users
  async sendToDevice(params: ISendNotification) {
    if (!this._initialized) throw new Error('Provider not initialized');
    const { sendTo, type } = params;
    const userId = sendTo;
    if (isNil(userId)) return;

    const notificationToken = await NotificationToken.getInstance().findOne({
      userId,
    });
    if (isNil(notificationToken)) {
      return;
    }
    const { title, body, data } = params;
    const message: firebase.messaging.Message = {
      token: notificationToken.token,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        type: type ?? '',
      },
    };
    return this.fcm!.send(message);
  }

  async sendMany(params: ISendNotification[]) {
    const userIds = params.map(param => param.sendTo);
    const notificationsObj = keyBy(params, param => param.sendTo);

    const notificationTokens = await NotificationToken.getInstance().findMany({
      userId: { $in: userIds },
    });

    const promises = notificationTokens.map(async token => {
      const id = token.userId.toString();
      const data = notificationsObj[id];

      const message: firebase.messaging.Message = {
        notification: {
          title: data.title,
          body: data.body,
        },
        data: {
          ...data.data,
          type: data.type ?? '',
        },
        token: token.token,
      };

      await this.fcm!.send(message).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    });
    return Promise.all(promises);
  }

  async sendToManyDevices(params: ISendNotificationToManyDevices) {
    const notificationTokens = await NotificationToken.getInstance().findMany({
      userId: { $in: params.sendTo },
    });
    if (notificationTokens.length === 0) return;

    const promises = notificationTokens.map(async notToken => {
      const message: firebase.messaging.Message = {
        token: notToken.token,
        notification: {
          title: params.title,
          body: params.body,
        },
        data: {
          ...params.data,
          type: params.type ?? '',
        },
      };
      await this.fcm!.send(message);
    });
    return Promise.all(promises);
  }
}
