import {
  setNotificationConfig,
  setNotificationError,
  startNotificationLoading,
  stopNotificationLoading,
} from '../actions';

import {
  getNotificationConfig,
  putNotificationConfig,
  sendNotification,
} from '../../http/requests';

export const sendNewNotification = (data) => {
  return (dispatch) => {
    dispatch(startNotificationLoading());
    sendNotification(data)
      .then(() => {
        dispatch(stopNotificationLoading());
        dispatch(setNotificationError(null));
      })
      .catch((err) => {
        dispatch(stopNotificationLoading());
        dispatch(setNotificationError(err));
      });
  };
};

export const getConfig = () => {
  return (dispatch) => {
    dispatch(startNotificationLoading());
    getNotificationConfig()
      .then((res) => {
        dispatch(stopNotificationLoading());
        dispatch(setNotificationConfig(res.data));
        dispatch(setNotificationError(null));
      })
      .catch((err) => {
        dispatch(stopNotificationLoading());
        dispatch(setNotificationError(err));
      });
  };
};

export const saveConfig = () => {
  return (dispatch) => {
    dispatch(startNotificationLoading());
    putNotificationConfig()
      .then((res) => {
        dispatch(stopNotificationLoading());
        dispatch(setNotificationConfig(res.data));
        dispatch(setNotificationError(null));
      })
      .catch((err) => {
        dispatch(stopNotificationLoading());
        dispatch(setNotificationError(err));
      });
  };
};
