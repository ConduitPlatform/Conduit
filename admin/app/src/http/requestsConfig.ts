import axios from 'axios';
import getConfig from 'next/config';
import { getCurrentStore } from '../redux/store';
import { asyncLogout } from '../redux/slices/appAuthSlice';
import { sanitizeRequestParams } from '../utils/sanitizeRequestParams';
import Router from 'next/router';

const {
  publicRuntimeConfig: { CONDUIT_URL, MASTER_KEY },
} = getConfig();

export const CONDUIT_API = process.env.IS_DEV ? process.env.CONDUIT_URL : CONDUIT_URL;

export const config = {
  masterkey: process.env.IS_DEV ? process.env.MASTER_KEY : MASTER_KEY,
};

const JWT_CONFIG = (token: string) => ({
  ...config,
  Authorization: `JWT ${token}`,
});

axios.interceptors.request.use(
  (config) => {
    const reduxStore = getCurrentStore();
    const token = reduxStore.getState().appAuthSlice.data.token;

    if (token) {
      config.headers = JWT_CONFIG(token);
    }

    if (config.params) {
      config.params = sanitizeRequestParams(config.params);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error.response);
  }
);

axios.interceptors.response.use(
  (config) => {
    return config;
  },
  (error) => {
    if (error.response.status === 401) {
      const reduxStore = getCurrentStore();
      if (reduxStore) {
        reduxStore.dispatch(asyncLogout());
        Router.replace('/login');
      }
    }
    return Promise.reject(error.response);
  }
);
