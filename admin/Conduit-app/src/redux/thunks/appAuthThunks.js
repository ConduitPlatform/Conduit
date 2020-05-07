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

// todo create logout
// todo clear all store data ( initial state for every reducer )

// todo use logout when user sign out and when u got 401 error page
export const logout = () => {
  return (dispatch) => {
    dispatch(clearAuthPageStore());
    dispatch(clearEmailPageStore());
    dispatch(clearNotificationPageStore());
    dispatch(clearStoragePageStore());
    // todo dispatch cmsPage when merge with master
    removeCookie('JWT');
  };
};
