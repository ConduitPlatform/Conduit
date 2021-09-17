import axios from 'axios';
import { CONDUIT_API } from './requests';

export const sendNotification = (data) =>
  axios.post(`${CONDUIT_API}/notifications/send`, {
    ...data,
  });

export const getNotificationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/push-notifications`);

export const putNotificationConfig = (
  projectId,
  productKey,
  clientEmail //Todo fix this
) =>
  axios.put(`${CONDUIT_API}/admin/config/push-notifications`, {
    projectId,
    productKey,
    clientEmail,
  });
