import {
  addAuthUsers,
  setAuthUsersError,
  startAuthUsersLoading,
  stopAuthUsersLoading,
} from '../actions';
import { getAuthUsersDataReq } from '../../http/requests';

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
