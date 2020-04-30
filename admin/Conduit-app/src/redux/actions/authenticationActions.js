import {
  ADD_AUTH_USERS,
  CLEAR_AUTH_PAGE_STORE,
  SET_AUTH_USERS_ERROR,
  SET_AUTHENTICATION_CONFIG,
  SET_AUTHENTICATION_CONFIG_ERROR,
  START_AUTH_USERS_LOADING,
  START_AUTHENTICATION_CONFIG_LOADING,
  STOP_AUTH_USERS_LOADING,
  STOP_AUTHENTICATION_CONFIG_LOADING,
} from './actionTypes';

//Auth Users actions
export const addAuthUsers = (data) => ({
  type: ADD_AUTH_USERS,
  payload: data,
});

export const startAuthUsersLoading = () => ({
  type: START_AUTH_USERS_LOADING,
});

export const stopAuthUsersLoading = () => ({
  type: STOP_AUTH_USERS_LOADING,
});

export const setAuthUsersError = (error) => ({
  type: SET_AUTH_USERS_ERROR,
  payload: { error },
});
//--------------//

//Config actions
export const setAuthenticationConfig = (data) => ({
  type: SET_AUTHENTICATION_CONFIG,
  payload: data,
});

export const startAuthenticationConfigLoading = () => ({
  type: START_AUTHENTICATION_CONFIG_LOADING,
});

export const stopAuthenticationConfigLoading = () => ({
  type: STOP_AUTHENTICATION_CONFIG_LOADING,
});

export const setAuthenticationConfigError = (error) => ({
  type: SET_AUTHENTICATION_CONFIG_ERROR,
  payload: { error },
});

export const clearAuthPageStore = () => ({
  type: CLEAR_AUTH_PAGE_STORE,
});
