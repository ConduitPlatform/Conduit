import { ISendNotification, ISendNotificationToManyDevices } from './ISendNotification';
import { SendNotificationRequest } from '../types';

export interface IPushNotificationsProvider {
  sendToDevice(params: ISendNotification): Promise<any>;

  sendMany(params: ISendNotification[]): Promise<any>;

  sendToManyDevices(params: ISendNotificationToManyDevices): Promise<any>;
}
