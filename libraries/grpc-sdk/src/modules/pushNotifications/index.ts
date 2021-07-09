import { ConduitModule } from '../../classes/ConduitModule';
import { PushNotificationsClient } from '../../protoUtils/push-notifications';

export default class PushNotifications extends ConduitModule<PushNotificationsClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(PushNotificationsClient);
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  sendNotificationToken(token: string, platform: string, userId: string) {
    return new Promise((resolve, reject) => {
      this.client?.setNotificationToken(
        {
          token,
          platform,
          userId,
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.newTokenDocument));
          }
        }
      );
    });
  }

  getNotificationTokens(userId: string) {
    return new Promise((resolve, reject) => {
      this.client?.getNotificationTokens(
        {
          userId,
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.tokenDocuments));
          }
        }
      );
    });
  }
}
