import { BaseNotificationProvider } from './base.provider';
import { IFirebaseSettings } from '../interfaces/IFirebaseSettings';
import * as firebase from 'firebase-admin';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification';
import { isNil, keyBy } from 'lodash';
import { NotificationToken } from '../models';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class FirebaseProvider extends BaseNotificationProvider {
  private fcm?: firebase.messaging.Messaging;
  private _initialized: boolean = false;

  constructor(settings: IFirebaseSettings) {
    super();
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
    await super.sendToDevice(params);
    const { sendTo, type } = params;
    if (isNil(sendTo)) return;

    const notificationToken = (await super.fetchTokens(sendTo)) as NotificationToken;

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
    if (!this._initialized) throw new Error('Provider not initialized');

    await super.sendMany(params);
    const userIds = params.map(param => param.sendTo);
    const notificationsObj = keyBy(params, param => param.sendTo);

    const notificationTokens = (await super.fetchTokens(userIds)) as NotificationToken[];
    if (!notificationTokens || notificationTokens.length === 0)
      throw new Error('Could not find tokens');
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
    if (!this._initialized) throw new Error('Provider not initialized');

    await super.sendToManyDevices(params);
    const notificationTokens = (await super.fetchTokens(
      params.sendTo,
    )) as NotificationToken[];

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
