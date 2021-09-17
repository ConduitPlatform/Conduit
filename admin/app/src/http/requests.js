import axios from 'axios';
import store from '../redux/store';
import { asyncLogout } from '../redux/slices/appAuthSlice';
import Router from 'next/router';
import getConfig from 'next/config';

const {
  publicRuntimeConfig: { CONDUIT_URL, MASTER_KEY },
} = getConfig();

export const CONDUIT_API = process.env.IS_DEV ? process.env.CONDUIT_URL : CONDUIT_URL;

const config = {
  masterkey: process.env.IS_DEV ? process.env.MASTER_KEY : MASTER_KEY,
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
    const token = store().getState().appAuthSlice.data.token;
    if (token) {
      config.headers = JWT_CONFIG(token);
    }
    return config;
  },
  (error) => {
    console.log(error);
    return Promise.reject(error.response);
  }
);

axios.interceptors.response.use(
  (config) => {
    return config;
  },
  (error) => {
    console.log(error);
    if (error.response.status === 401) {
      if (store) {
        store().dispatch(asyncLogout());
        Router.replace('/login');
      }
    }
    console.log(error);
    return Promise.reject(error.response);
  }
);

//Requests
export const getAuthUsersDataReq = (skip, limit, search, filter) =>
  axios.get(`${CONDUIT_API}/admin/authentication/users`, {
    params: {
      skip,
      limit,
      identifier: search ? search : undefined,
      provider: filter !== 'none' ? filter : undefined,
    },
  });

export const createNewUsers = ({ email, password }) =>
  axios.post(`${CONDUIT_API}/admin/authentication/users`, {
    identification: email,
    password: password,
  });

export const editUser = (values) =>
  axios.put(`${CONDUIT_API}/admin/authentication/users/${values._id}`, {
    ...values,
  });

export const deleteUser = (id) => {
  return axios.delete(`${CONDUIT_API}/admin/authentication/users/${id}`);
};

export const searchUser = (identifier) => {
  return axios.get(`${CONDUIT_API}/admin/authentication/users`, {
    params: {
      identifier: identifier,
    },
  });
};

export const blockUser = (id) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/users/${id}/block`);
};

export const unblockUser = (id) => {
  return axios.post(`${CONDUIT_API}/admin/authentication/users/${id}/unblock`);
};

export const getAuthenticationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/authentication`);

export const putAuthenticationConfig = (body) =>
  axios.put(`${CONDUIT_API}/admin/config/authentication`, body);

//REQUEST FOR EMAILS
export const getEmailTemplateRequest = () =>
  axios.get(`${CONDUIT_API}/admin/email/templates`);

export const postEmailTemplateRequest = (data) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const putEmailTemplateRequest = (templateId, data) =>
  axios.put(`${CONDUIT_API}/admin/email/templates/${templateId}`, { ...data });

export const getEmailSettingsRequest = () =>
  axios.get(`${CONDUIT_API}/admin/config/email`);

export const putEmailSettingsRequest = (data) =>
  axios.put(`${CONDUIT_API}/admin/config/email`, { ...data });

export const sendEmailRequest = (data) =>
  axios.post(`${CONDUIT_API}/admin/email/send`, { ...data });

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

export const getNotificationConfig = () =>
  axios.get(`${CONDUIT_API}/admin/config/push-notifications`);

export const putNotificationConfig = (projectId, productKey, clientEmail) =>
  axios.put(`${CONDUIT_API}/admin/config/push-notifications`, {
    projectId,
    productKey,
    clientEmail,
  });

/** CMS requests **/
export const getCmsSchemasRequest = (skip, limit) =>
  axios.get(`${CONDUIT_API}/admin/cms/schemas`, { params: { skip, limit } });

export const getCmsSchemaByIdRequest = (_id) =>
  axios.get(`${CONDUIT_API}/admin/cms/schemas${_id}`);

export const postCmsSchemaRequest = (data) =>
  axios.post(`${CONDUIT_API}/admin/cms/schemas`, { ...data });

export const putCmsSchemaRequest = (_id, data) =>
  axios.put(`${CONDUIT_API}/admin/cms/schemas/${_id}`, { ...data });

export const deleteCmsSchemaRequest = (_id) =>
  axios.delete(`${CONDUIT_API}/admin/cms/schemas/${_id}`);

export const toggleSchemaByIdRequest = (_id) =>
  axios.put(`${CONDUIT_API}/admin/cms/schemas/toggle/${_id}`);

export const getCmsDocumentsByNameRequest = (name, skip = 0, limit = 10) =>
  axios.get(`${CONDUIT_API}/admin/cms/content/${name}`, { params: { skip, limit } });

export const schemasFromOtherModules = () => {
  return axios.get(`${CONDUIT_API}/admin/cms/schemasFromOtherModules`);
};
//-----------------------//

/** Cloud storage requests **/
export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);

export const putStorageSettings = (storageData) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });
//-----------------------//
