import {
  addAuthUsers,
  blockUserUI,
  deleteUserAction,
  editUserAction,
  increaseCount,
  setAuthenticationConfig,
  setAuthenticationConfigError,
  setAuthUsersError,
  setAuthUsersSuccess,
  startAuthenticationConfigLoading,
  startAuthUsersLoading,
  stopAuthenticationConfigLoading,
  stopAuthUsersLoading,
  unBlockUserUI,
} from '../actions';
import {
  blockUser,
  createNewUsers,
  deleteUser,
  editUser,
  getAuthenticationConfig,
  getAuthUsersDataReq,
  putAuthenticationConfig,
  unblockUser,
} from '../../http/requests';

export const getAuthUsersData = (skip, limit, search, filter) => {
  return (dispatch) => {
    dispatch(startAuthUsersLoading());
    getAuthUsersDataReq(skip, limit, search, filter)
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

export const addNewUserThunk = (values, availableUsers, limit) => {
  const filter = { filterValue: 'none' };
  return (dispatch, getState) => {
    createNewUsers(values)
      .then((res) => {
        if (getState().authenticationPageReducer.authUsersState.users.length >= limit) {
          dispatch(setAuthUsersSuccess(res.data.message));
          dispatch(increaseCount());
          dispatch(stopAuthUsersLoading());
          setTimeout(() => {
            dispatch(setAuthUsersSuccess(null));
          }, 6300);
          dispatch(setAuthUsersError(null));
        } else {
          dispatch(getAuthUsersData(0, limit, '', filter));
          dispatch(stopAuthUsersLoading());
          dispatch(setAuthUsersError(null));
        }
      })
      .catch((err) => {
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(err));
        console.log(err);
      });
  };
};

export const editUserThunk = (values) => {
  return (dispatch) => {
    dispatch(startAuthUsersLoading());
    editUser(values)
      .then((res) => {
        dispatch(editUserAction(values));
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(null));
      })
      .catch((err) => {
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(err));
      });
  };
};

export const unblockUserUIThunk = (id) => {
  return (dispatch) => {
    dispatch(startAuthUsersLoading());
    unblockUser(id)
      .then(() => {
        dispatch(unBlockUserUI(id));
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(null));
      })
      .catch((err) => {
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(err));
      });
  };
};

export const blockUserUIThunk = (id) => {
  return (dispatch) => {
    dispatch(startAuthUsersLoading());
    blockUser(id)
      .then(() => {
        dispatch(blockUserUI(id));
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(null));
      })
      .catch((err) => {
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(err));
      });
  };
};

export const deleteUserThunk = (id) => {
  return async (dispatch) => {
    dispatch(startAuthUsersLoading());
    deleteUser(id)
      .then((res) => {
        dispatch(deleteUserAction(id));
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(null));
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
