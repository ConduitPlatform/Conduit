import { ISendNotification, ISendNotificationToManyDevices } from './ISendNotification';

export interface IPushNotificationsProvider {
  sendToDevice(params: ISendNotification): Promise<any>;

  sendMany(params: ISendNotification[]): Promise<any>;

  sendToManyDevices(
    params: ISendNotificationToManyDevices,
  ): Promise<any>;
}
