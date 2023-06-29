import { BaseNotificationProvider } from './base.provider';
import { IFirebaseSettings } from '../interfaces/IFirebaseSettings';
import * as firebase from 'firebase-admin';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class FirebaseProvider extends BaseNotificationProvider<IFirebaseSettings> {
  private fcm?: firebase.messaging.Messaging;

  constructor(settings: IFirebaseSettings) {
    super();
    this._initialized = false;
    this.updateProvider(settings);
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

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ) {
    const { title, body, data } = params;

    let message: firebase.messaging.Message;
    if (params.isSilent) {
      message = {
        token: token,
        data: {
          ...data,
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
        },
      };
    } else {
      message = {
        token: token,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
        },
      };
    }
    return this.fcm!.send(message);
  }
}
