import { IPushNotifications } from './interfaces/IPushNotifications';

export class PushNotifications {

  private static _instance: PushNotifications;
  private static _provider: IPushNotifications;

  constructor(name: string, settings: any) {
  }

  public static getInstance(name?: string, settings?: any) {
    if (!this._instance && name && settings) {
      this._instance = new PushNotifications(name, settings);
    } else if (this._instance) {
      return this._instance
    } else {
      throw new Error("No settings provided to initialize");
    }
  }
  // sendToDevice(): Promise<any> {
  //   return ;
  // }
}
