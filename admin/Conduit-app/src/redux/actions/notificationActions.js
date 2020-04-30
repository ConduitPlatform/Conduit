import {
  SET_NOTIFICATION_CONFIG,
  SET_NOTIFICATION_ERROR,
  START_NOTIFICATION_LOADING,
  STOP_NOTIFICATION_LOADING,
} from './actionTypes';

export const setNotificationConfig = (config) => ({
  type: SET_NOTIFICATION_CONFIG,
  payload: config
});


export const startNotificationLoading = () => ({
  type: START_NOTIFICATION_LOADING,
});

export const stopNotificationLoading = () => ({
  type: STOP_NOTIFICATION_LOADING,
});

export const setNotificationError = error => ({
  type: SET_NOTIFICATION_ERROR,
  payload: { error }
});
