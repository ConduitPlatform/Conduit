import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { NotificationData } from '../models/notifications/NotificationModels';

export const sendNotification = (data: NotificationData) =>
  axios.post(`${CONDUIT_API}/admin/pushnotifications/sendToManyDevices`, {
    ...data,
  });

export const getNotificationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/pushNotifications`);

export const putNotificationConfig = (data: {
  active: boolean;
  providerName: string;
  projectId: string;
  privateKey: string;
  clientEmail: string;
}) =>
  axios.put(`${CONDUIT_API}/admin/config/pushNotifications`, {
    ...data,
  });
