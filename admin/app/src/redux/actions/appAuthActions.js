import {
  CLEAR_AUTHENTICATION_TOKEN,
  SET_ADMIN_MODULES,
  SET_AUTHENTICATION_TOKEN,
  SET_AUTHENTICATION_TOKEN_ERROR,
  START_AUTHENTICATION_LOADING,
  STOP_AUTHENTICATION_LOADING,
} from './actionTypes';

//Token actions
export const setAuthenticationToken = (token, cookie = false) => ({
  type: SET_AUTHENTICATION_TOKEN,
  payload: token,
  cookie: cookie,
});

export const startAuthenticationLoading = () => ({
  type: START_AUTHENTICATION_LOADING,
});

export const stopAuthenticationLoading = () => ({
  type: STOP_AUTHENTICATION_LOADING,
});

export const setAuthenticationError = (error) => ({
  type: SET_AUTHENTICATION_TOKEN_ERROR,
  payload: { error },
});

export const clearAuthenticationToken = () => ({
  type: CLEAR_AUTHENTICATION_TOKEN,
});

export const setAdminModules = (data) => ({
  type: SET_ADMIN_MODULES,
  payload: data,
});
