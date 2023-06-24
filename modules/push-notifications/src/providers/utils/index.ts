import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../../interfaces/ISendNotification';

export function validateNotification(
  notification: ISendNotification | ISendNotificationToManyDevices,
) {
  if (notification.isSilent && (notification.title || notification.body)) {
    throw new Error('Cannot send a silent notification with a title');
  }
  if (notification.isSilent && !notification.data) {
    throw new Error('Cannot send a silent notification without data');
  }
  return true;
}
