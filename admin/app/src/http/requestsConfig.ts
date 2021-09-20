import axios from 'axios';
import store from '../redux/store';
import { asyncLogout } from '../redux/slices/appAuthSlice';
import Router from 'next/router';
import getConfig from 'next/config';

const {
  publicRuntimeConfig: { CONDUIT_URL, MASTER_KEY },
} = getConfig();

export const CONDUIT_API = process.env.IS_DEV ? process.env.CONDUIT_URL : CONDUIT_URL;

export const config = {
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
