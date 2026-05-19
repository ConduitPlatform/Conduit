import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { getMessaging, Message, Messaging } from 'firebase-admin/messaging';
import { cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { NotificationToken } from '../../models/index.js';
import { IFirebaseSettings } from '../../interfaces/index.js';
import { ISendNotification, ISendNotificationToManyDevices } from './interfaces/index.js';

export class FirebaseProvider extends BaseNotificationProvider<IFirebaseSettings> {
  private fcm?: Messaging;

  constructor(settings: IFirebaseSettings) {
    super();
    this._initialized = false;
    this.isBaseProvider = false;
    this.updateProvider(settings);
  }

  updateProvider(settings: IFirebaseSettings) {
    const serviceAccount: ServiceAccount = {
      projectId: settings.projectId,
      privateKey: settings.privateKey.replace(/\\n/g, '\n'),
      clientEmail: settings.clientEmail,
    };
    try {
      this.fcm = getMessaging(
        initializeApp(
          {
            credential: cert(serviceAccount),
          },
          serviceAccount.projectId,
        ),
      );
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

    let message: Message;
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
    return this.fcm!.send(message).catch(e => {
      ConduitGrpcSdk.Logger.error('Failed to send notification: ', e);
      NotificationToken.getInstance().deleteOne({ token });
    });
  }
}
