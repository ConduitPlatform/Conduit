import { ISendNotification, ISendNotificationToManyDevices } from './ISendNotification';

export interface IPushNotificationsProvider {
  sendToDevice(params: ISendNotification, databaseAdapter: any): Promise<any>;

  sendMany(params: ISendNotification[], databaseAdapter: any): Promise<any>;

  sendToManyDevices(
    params: ISendNotificationToManyDevices,
    databaseAdapter: any
  ): Promise<any>;
}
