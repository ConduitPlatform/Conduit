import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';

export default class PushNotifications extends ConduitModule {
  constructor(url: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/push-notifications.proto');
    this.descriptorObj = 'pushnotifications.PushNotifications';
    this.initializeClient();
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig(
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
      this.client.sendNotificationToken(
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
      this.client.getNotificationTokens(
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
