import {
  clearAuthenticationToken,
  setAuthenticationError,
  setAuthenticationToken,
  startAuthenticationLoading,
  stopAuthenticationLoading,
  clearAuthPageStore,
  clearStoragePageStore,
  clearNotificationPageStore,
} from '../actions';
import { clearEmailPageStore } from '../actions/emailsActions';
import { loginRequest } from '../../http/requests';
import { removeCookie } from '../../utils/cookie';
import { CLEAR_AUTHENTICATION_TOKEN } from '../actions/actionTypes';

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
    // todo dispatch cmsPage when merge with master
    dispatch(clearAuthenticationToken());
    removeCookie('JWT');
  };
};
