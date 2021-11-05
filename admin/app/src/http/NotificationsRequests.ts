import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { NotificationData } from '../models/notifications/NotificationModels';

// {userIds: [], title: '', body: '', data: ''}
export const sendNotification = (data: NotificationData) =>
  axios.post(`${CONDUIT_API}/admin/pushnotifications/sendToManyDevices`, {
    ...data,
  });

export const getNotificationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/push-notifications`);

export const putNotificationConfig = (data: {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}) =>
  axios.put(`${CONDUIT_API}/admin/config/push-notifications`, {
    projectId: data.projectId,
    privateKey: data.privateKey,
    clientEmail: data.clientEmail,
  });
