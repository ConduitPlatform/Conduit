import axios from 'axios';
import store from '../redux/store';
import { logout } from '../redux/thunks/appAuthThunks';
import Router from 'next/router';

const CONDUIT_API = 'http://13.95.17.12';
const config = {
  masterkey: 'M4ST3RK3Y',
};

const JWT_CONFIG = (token) => ({
  ...config,
  Authorization: `JWT ${token}`,
});

//Interceptors
axios.interceptors.request.use(
  (config) => {
    if (!store) {
      return config;
    }
    const token = store().getState().appAuthReducer.token;
    if (token) {
      config.headers = JWT_CONFIG(token);
    }
    return config;
  },
  (error) => {
    // eslint-disable-next-line no-undef
    console.log(error);
    // eslint-disable-next-line no-undef
    return Promise.reject(error.response);
  }
);

axios.interceptors.response.use(
  (config) => {
    return config;
  },
  (error) => {
    // eslint-disable-next-line no-undef
    console.log(error);
    if (error.response.status === 401) {
      if (store) {
        store().dispatch(logout());
        Router.replace('/login');
      }
    }
    // eslint-disable-next-line no-undef
    console.log(error);
    // eslint-disable-next-line no-undef
    return Promise.reject(error.response);
  }
);

//Requests
export const getAuthUsersDataReq = (skip, limit) =>
  axios.get(`${CONDUIT_API}/admin/users`, {
    params: {
      skip,
      limit,
    },
  });

export const getAuthenticationConfig = () => axios.get(`${CONDUIT_API}/admin/authentication/config`);

export const putAuthenticationConfig = (body) => axios.put(`${CONDUIT_API}/admin/authentication/config`, body);

//REQUEST FOR EMAILS
export const getEmailTemplateRequest = () => axios.get(`${CONDUIT_API}/admin/email/templates`);

export const postEmailTemplateRequest = (data) => axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const putEmailTemplateRequest = (templateId, data) =>
  axios.put(`${CONDUIT_API}/admin/email/templates/${templateId}`, { ...data });

export const getEmailSettingsRequest = () => axios.get(`${CONDUIT_API}/admin/email/config`);
export const putEmailSettingsRequest = (data) => axios.put(`${CONDUIT_API}/admin/email/config`, { ...data });

export const sendEmailRequest = (data) => axios.post(`${CONDUIT_API}/admin/email/send`, { ...data });

export const loginRequest = (username, password) =>
  axios.post(
    `${CONDUIT_API}/admin/login`,
    {
      username,
      password,
    },
    { headers: config }
  );

/** Notifications  requests **/
export const sendNotification = (data) =>
  axios.post(`${CONDUIT_API}/notifications/send`, {
    ...data,
  });
export const getNotificationConfig = () => axios.get(`${CONDUIT_API}/admin/config/push-notifications`);
export const putNotificationConfig = (projectId, productKey, clientEmail) =>
  axios.put(`${CONDUIT_API}/admin/config/push-notifications`, {
    projectId,
    productKey,
    clientEmail,
  });

/** Cloud storage requests **/
export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);
export const putStorageSettings = (storageData) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });
