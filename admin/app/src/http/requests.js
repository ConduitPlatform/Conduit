import axios from 'axios';
import store from '../redux/store';
import { logout } from '../redux/thunks/appAuthThunks';
import Router from 'next/router';

const CONDUIT_API = 'http://23.97.149.151:3000';
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

//CMS requests
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
export const getCmsDocumentsByNameRequest = (name) =>
  axios.get(`${CONDUIT_API}/admin/cms/content/${name}`);

/** Cloud storage requests **/
export const getStorageSettings = () => axios.get(`${CONDUIT_API}/admin/config/storage`);
export const putStorageSettings = (storageData) =>
  axios.put(`${CONDUIT_API}/admin/config/storage`, {
    ...storageData,
  });

export const createSchemaDocumentRequest = (schemaName, documentData) =>
  axios.post(`${CONDUIT_API}/admin/cms/content/${schemaName}`, { ...documentData });

export const deleteSchemaDocumentRequest = (schemaName, documentId) =>
  axios.delete(`${CONDUIT_API}/admin/cms/schemas/${schemaName}/${documentId}`);

export const editSchemaDocumentRequest = (schemaName, documentId, documentData) =>
  axios.put(`${CONDUIT_API}/admin/cms/schemas/${schemaName}/${documentId}`, {
    ...documentData,
  });

export const getCustomEndpointsRequest = () => {
  return axios.get(`${CONDUIT_API}/admin/cms/customEndpoints`);
};
export const editCustomEndpointsRequest = (_id, endpointData) => {
  return axios.put(`${CONDUIT_API}/admin/cms/customEndpoints/${_id}`, endpointData);
};
export const deleteCustomEndpointsRequest = (_id) => {
  return axios.delete(`${CONDUIT_API}/admin/cms/customEndpoints/${_id}`);
};
export const createCustomEndpointsRequest = (endpointData) => {
  return axios.post(`${CONDUIT_API}/admin/cms/customEndpoints`, { endpointData });
};
