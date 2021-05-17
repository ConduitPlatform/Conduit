import {
  addAuthUsers,
  setAuthUsersError,
  startAuthUsersLoading,
  stopAuthUsersLoading,
} from '../actions';
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

// export const searchUsersThunk = (values, filter, skip, limit) => {
//   console.log(skip, limit);
//   return (dispatch) => {
//     searchUser(values, filter, skip, limit)
//       .then((res) => dispatch(searchUsers(res.data)))
//       .catch((err) => console.log(err));
//   };
// };

export const addNewUserThunk = (values) => {
  return (dispatch) => {
    dispatch(startAuthUsersLoading());
    createNewUsers(values)
      .then((res) => {
        dispatch(getAuthUsersData(0, 10));
        dispatch(stopAuthUsersLoading());
        dispatch(setAuthUsersError(null));
      })
      .catch((err) => {
        dispatch(setAuthUsersError(err));
        console.log(err);
        dispatch(stopAuthUsersLoading());
      });
  };
};

export const deleteUserThunk = (id) => {
  return (dispatch) => {
    deleteUser(id)
      .then((res) => {
        dispatch(deleteUserAction(id));
      })
      .catch((err) => console.log(err));
  };
};

export const editUserThunk = (values) => {
  return (dispatch) => {
    editUser(values).then((res) => dispatch(editUserAction(values)));
  };
};

export const unblockUserUIThunk = (id) => {
  return async (dispatch) => {
    try {
      dispatch(startAuthUsersLoading());
      await unblockUser(id);
      await dispatch(unBlockUserUI(id));
      dispatch(stopAuthUsersLoading());
      dispatch(setAuthUsersError(null));
    } catch (err) {
      console.log(err);
    }
  };
};

export const blockUserUIThunk = (id) => {
  return async (dispatch) => {
    try {
      dispatch(startAuthUsersLoading());
      await blockUser(id);
      await dispatch(blockUserUI(id));
      dispatch(stopAuthUsersLoading());
      dispatch(setAuthUsersError(null));
    } catch (err) {
      console.log(err);
    }
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
