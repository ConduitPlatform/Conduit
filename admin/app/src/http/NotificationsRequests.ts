import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import {
  INotificationSettings,
  NotificationData,
} from '../models/notifications/NotificationModels';

export const sendNotification = (data: NotificationData) =>
  axios.post(`${CONDUIT_API}/admin/pushNotifications/sendToManyDevices`, {
    ...data,
  });

export const getNotificationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/pushNotifications`);

export const putNotificationConfig = (data: INotificationSettings) =>
  axios.put(`${CONDUIT_API}/admin/config/pushNotifications`, {
    ...data,
  });
