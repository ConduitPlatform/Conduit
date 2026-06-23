import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  getMessaging,
  Message,
  Messaging,
  MulticastMessage,
} from 'firebase-admin/messaging';
import { cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { NotificationToken } from '../../models/index.js';
import { IFirebaseSettings } from '../../interfaces/index.js';
import {
  IPushBatchResult,
  IPushSendFailure,
  IPushTokenTarget,
  ISendNotification,
  ISendNotificationToManyDevices,
} from './interfaces/index.js';

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

  private buildFcmPayload(
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Omit<MulticastMessage, 'tokens'> {
    const { title, body, data } = params;
    if (params.isSilent) {
      return {
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
    }
    return {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
      },
    };
  }

  private isPermanentFcmTokenError(error: unknown): boolean {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  }

  private async deleteToken(token: string): Promise<void> {
    await NotificationToken.getInstance().deleteOne({ token });
  }

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ) {
    const message: Message = {
      token,
      ...this.buildFcmPayload(params),
    };
    return this.fcm!.send(message).catch(e => {
      ConduitGrpcSdk.Logger.error('Failed to send notification: ', e);
      if (this.isPermanentFcmTokenError(e)) {
        void this.deleteToken(token);
      }
    });
  }

  async sendMessages(
    targets: IPushTokenTarget[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<IPushBatchResult> {
    const multicast: MulticastMessage = {
      tokens: targets.map(target => target.token),
      ...this.buildFcmPayload(params),
    };

    const failures: IPushSendFailure[] = [];
    const deletePromises: Promise<void>[] = [];

    let response;
    try {
      response = await this.fcm!.sendEachForMulticast(multicast);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Failed to send multicast notification: ${error}`);
      return {
        successCount: 0,
        failureCount: targets.length,
        failures: targets.map(target => ({
          token: target.token,
          platform: target.platform,
          error,
          reason:
            error && typeof error === 'object' && 'code' in error
              ? String((error as { code?: string }).code)
              : undefined,
        })),
      };
    }

    response.responses.forEach((sendResponse, index) => {
      if (sendResponse.success) return;
      const target = targets[index];
      const error = sendResponse.error;
      ConduitGrpcSdk.Logger.error('Failed to send notification: ', error);
      failures.push({
        token: target.token,
        platform: target.platform,
        error,
        reason: error?.code,
      });
      if (this.isPermanentFcmTokenError(error)) {
        deletePromises.push(this.deleteToken(target.token));
      }
    });

    await Promise.all(deletePromises);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      failures,
    };
  }
}
