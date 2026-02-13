import { ConduitModule } from '../../classes/index.js';
import {
  PushNotificationsDefinition,
  SendNotificationResponse,
} from '../../protoUtils/index.js';
import { SendNotificationOptions } from './types';
import { isNil } from 'lodash';

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
    doNotStore?: boolean,
    isSilent?: boolean,
  ): Promise<SendNotificationResponse>;

  sendNotification(
    sendTo: string,
    title: string,
    options?: SendNotificationOptions,
  ): Promise<SendNotificationResponse>;

  sendNotification(
    sendTo: string,
    title: string,
    bodyOrOptions?: string | SendNotificationOptions,
    data?: string,
    platform?: string,
    doNotStore?: boolean,
    isSilent?: boolean,
  ) {
    let options: SendNotificationOptions;
    if (typeof bodyOrOptions === 'string' || isNil(bodyOrOptions)) {
      options = { body: bodyOrOptions, data, platform, doNotStore, isSilent };
    } else {
      options = bodyOrOptions;
    }
    return this.client!.sendNotification({
      sendTo,
      title,
      ...options,
    });
  }

  sendManyNotifications(
    notifications: [
      {
        sendTo: string;
        title: string;
        body?: string;
        data?: string;
        platform?: string;
        doNotStore?: boolean;
        isSilent?: boolean;
      },
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
    doNotStore?: boolean,
    isSilent?: boolean,
  ): Promise<SendNotificationResponse>;

  sendNotificationToManyDevices(
    sendTo: string[],
    title: string,
    options?: SendNotificationOptions,
  ): Promise<SendNotificationResponse>;

  sendNotificationToManyDevices(
    sendTo: string[],
    title: string,
    bodyOrOptions?: string | SendNotificationOptions,
    data?: string,
    platform?: string,
    doNotStore?: boolean,
    isSilent?: boolean,
  ) {
    let options: SendNotificationOptions;
    if (typeof bodyOrOptions === 'string' || isNil(bodyOrOptions)) {
      options = { body: bodyOrOptions, data, platform, doNotStore, isSilent };
    } else {
      options = bodyOrOptions;
    }
    return this.client!.sendNotificationToManyDevices({
      sendTo,
      title,
      ...options,
    });
  }
}
