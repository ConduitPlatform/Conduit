import { ConduitModule } from '../../classes/index.js';
import {
  PushNotificationsDefinition,
  SendNotificationResponse,
} from '../../protoUtils/index.js';
import {
  SendNotificationParamEnum,
  SendNotificationParams,
  SendNotificationToManyDevicesParamEnum,
  SendNotificationToManyDevicesParams,
} from './types';
import { normalizeParams } from '../../utilities/normalizeParams';

export class PushNotifications extends ConduitModule<typeof PushNotificationsDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'push-notifications', url, grpcToken);
    this.initializeClient(PushNotificationsDefinition);
  }

  sendNotificationToken(token: string, platform: string, userId: string) {
    return this.client!.setNotificationToken({
      token,
      platform,
      userId,
    }).then(res => {
      return JSON.parse(res.newTokenDocument);
    });
  }

  getNotificationTokens(userId: string) {
    return this.client!.getNotificationTokens({
      userId,
    }).then(res => {
      return res.tokenDocuments.map((tokenDocument: string) => {
        return JSON.parse(tokenDocument);
      });
    });
  }

  sendNotification(
    sendTo: string,
    title: string,
    body?: string,
    data?: string,
    platform?: string,
  ): Promise<SendNotificationResponse>;

  sendNotification(params: {
    sendTo: string;
    title: string;
    body?: string;
    data?: string;
    platform?: string;
  }): Promise<SendNotificationResponse>;

  sendNotification(...params: SendNotificationParams) {
    const obj = normalizeParams(params, Object.keys(SendNotificationParamEnum));
    return this.client!.sendNotification(obj);
  }

  sendManyNotifications(
    notifications: [
      { sendTo: string; title: string; body?: string; data?: string; platform?: string },
    ],
  ) {
    return this.client!.sendManyNotifications({
      notifications,
    });
  }

  sendNotificationToManyDevices(
    sendTo: string[],
    title: string,
    body?: string,
    data?: string,
    platform?: string,
  ): Promise<SendNotificationResponse>;

  sendNotificationToManyDevices(params: {
    sendTo: string[];
    title: string;
    body?: string;
    data?: string;
    platform?: string;
  }): Promise<SendNotificationResponse>;

  sendNotificationToManyDevices(...params: SendNotificationToManyDevicesParams) {
    const obj = normalizeParams(
      params,
      Object.keys(SendNotificationToManyDevicesParamEnum),
    );
    return this.client!.sendNotificationToManyDevices(obj);
  }
}
