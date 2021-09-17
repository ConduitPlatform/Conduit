import {
  setNotificationConfig,
  setNotificationError,
  startNotificationLoading,
  stopNotificationLoading,
} from '../actions';
import { putNotificationConfig } from '../../http/NotificationsRequests';

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
