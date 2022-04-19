import { ConduitModule } from '../../classes/ConduitModule';
import { PushNotificationsDefinition } from '../../protoUtils/push-notifications';

export class PushNotifications extends ConduitModule<typeof PushNotificationsDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(PushNotificationsDefinition);
  }

  setConfig(newConfig: any) {
    return this.client!.setConfig(
      { newConfig: JSON.stringify(newConfig) })
      .then(res => {
        return JSON.parse(res.updatedConfig);
      });
  }

  sendNotificationToken(token: string, platform: string, userId: string) {
    return this.client!.setNotificationToken(
      {
        token,
        platform,
        userId,
      })
      .then(res => {
        return JSON.parse(res.newTokenDocument);
      });
  }

  getNotificationTokens(userId: string) {
    return this.client!.getNotificationTokens(
      {
        userId,
      })
      .then(res => {
        return res.tokenDocuments;
      });
  }

  sendNotification(sendTo: string, title: string, body?: string, data?: string) {
    return this.client!.sendNotification(
      {
        sendTo,
        title,
        body,
        data,
      })
      .then(res => {
        return JSON.parse(res.message);
      });
  }
}
