import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/index.js';

export function validateNotification(
  notification: ISendNotification | ISendNotificationToManyDevices,
) {
  if (notification.isSilent && (notification.title || notification.body)) {
    throw new ModuleError(errors.INVALID_SILENT_NOTIFICATION);
  }
  if (notification.isSilent && !notification.data) {
    throw new ModuleError(errors.INVALID_SILENT_NOTIFICATION);
  }
  return true;
}
