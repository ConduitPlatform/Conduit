import {
  addAuthUsers,
  setAuthUsersError,
  startAuthUsersLoading,
  stopAuthUsersLoading,
} from '../actions/authenticationActions';
import {
  getAuthenticationConfig,
  getAuthUsersDataReq,
  putAuthenticationConfig,
} from '../../http/requests';
import {
  setAuthenticationConfig,
  setAuthenticationConfigError,
  startAuthenticationConfigLoading,
  stopAuthenticationConfigLoading,
} from '../actions';

export const getAuthUsersData = () => {
  return (dispatch) => {
    dispatch(startAuthUsersLoading());
    getAuthUsersDataReq(0, 100)
      .then((res) => {
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(null));
        dispatch(addAuthUsers(res.data));
      })
      .catch((err) => {
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(err));
      });
  };
};

export const getConfig = () => {
  return (dispatch) => {
    dispatch(startAuthenticationConfigLoading());
    getAuthenticationConfig()
      .then((res) => {
        dispatch(setAuthenticationConfig(res.data));
        dispatch(stopAuthenticationConfigLoading());
        dispatch(setAuthenticationConfigError(null));
      })
      .catch((err) => {
        dispatch(setAuthenticationConfigError(err));
        dispatch(stopAuthenticationConfigLoading());
      });
  };
};

export const updateConfig = (data) => {
  return (dispatch) => {
    dispatch(startAuthenticationConfigLoading());
    putAuthenticationConfig(data)
      .then((res) => {
        dispatch(setAuthenticationConfig(res.data));
        dispatch(stopAuthenticationConfigLoading());
        dispatch(setAuthenticationConfigError(null));
      })
      .catch((err) => {
        dispatch(setAuthenticationConfigError(err));
        dispatch(stopAuthenticationConfigLoading());
      });
  };
};
