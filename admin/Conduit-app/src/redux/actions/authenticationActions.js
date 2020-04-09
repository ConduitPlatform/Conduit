import {
  SET_AUTHENTICATION_TOKEN,
  SET_AUTHENTICATION_TOKEN_ERROR,
  START_AUTHENTICATION_LOADING,
  STOP_AUTHENTICATION_LOADING,
  CLEAR_AUTHENTICATION_TOKEN
} from "./actionTypes";

export const setAuthenticationToken = token => ({
  type: SET_AUTHENTICATION_TOKEN,
  payload: token
});


export const startAuthenticationLoading = () => ({
  type: START_AUTHENTICATION_LOADING
});

export const stopAuthenticationLoading = () => ({
  type: STOP_AUTHENTICATION_LOADING
});


export const setAuthenticationError = error => ({
  type: SET_AUTHENTICATION_TOKEN_ERROR,
  payload: {error}
});

export const clearAuthenticationToken = () => ({
  type: CLEAR_AUTHENTICATION_TOKEN,
});
