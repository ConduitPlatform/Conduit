import path from "path";
import grpc from "grpc";

let protoLoader = require("@grpc/proto-loader");

export default class PushNotifications {
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;

  constructor(url: string) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    let packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "../../proto/push-notifications.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    let notifications = protoDescriptor.pushnotifications.PushNotifications;
    this.client = new notifications(this._url, grpc.credentials.createInsecure());
    this.active = true;
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig({ newConfig: JSON.stringify(newConfig) }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(JSON.parse(res.updatedConfig));
        }
      });
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
            reject(err || "Something went wrong");
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
            reject(err || "Something went wrong");
          } else {
            resolve(JSON.parse(res.tokenDocuments));
          }
        }
      );
    });
  }
}
