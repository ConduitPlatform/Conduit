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

export const loginRequest = (username, password) =>
  axios.post(
    `${CONDUIT_API}/admin/login`,
    {
      username,
      password,
    },
    { headers: config }
  );
