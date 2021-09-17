import {
  clearAuthenticationToken,
  clearAuthPageStore,
  setAdminModules,
  setAuthenticationError,
  setAuthenticationToken,
  startAuthenticationLoading,
  stopAuthenticationLoading,
} from '../actions';

import { clearEmailPageStore } from '../slices/emailsSlice';
import { getAdminModulesRequest, loginRequest } from '../../http/requests';
import { clearNotificationPageStore } from '../slices/notificationsSlice';
import { clearStoragePageStore } from '../slices/storageSlice';

export const login = (username, password, remember) => {
  return (dispatch) => {
    dispatch(startAuthenticationLoading());
    loginRequest(username, password)
      .then((res) => {
        dispatch(stopAuthenticationLoading());
        dispatch(setAuthenticationToken(res.data.token, remember));
        dispatch(setAuthenticationError(null));
      })
      .catch((err) => {
        dispatch(stopAuthenticationLoading());
        dispatch(clearAuthenticationToken());
        dispatch(setAuthenticationError(err));
      });
  };
};

export const logout = () => {
  return (dispatch) => {
    dispatch(clearAuthPageStore());
    dispatch(clearEmailPageStore());
    dispatch(clearNotificationPageStore());
    dispatch(clearStoragePageStore());
    dispatch(clearAuthenticationToken());
  };
};

export const getAdminModules = () => {
  return (dispatch) => {
    dispatch(startAuthenticationLoading());
    getAdminModulesRequest()
      .then((res) => {
        dispatch(setAdminModules(res.data.modules));
        dispatch(stopAuthenticationLoading());
      })
      .catch((err) => {
        dispatch(setAuthenticationError(err));
        dispatch(stopAuthenticationLoading());
      });
  };
};
