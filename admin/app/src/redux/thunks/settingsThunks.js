import {
  setSettingsError,
  startSettingsLoading,
  stopSettingsLoading,
} from '../actions/settingsActions';
import { postNewAdminUser } from '../../http/SettingsRequests';

export const createNewAdminUser = (values) => {
  return (dispatch) => {
    dispatch(startSettingsLoading());
    const body = {
      username: values.username,
      password: values.password,
    };
    postNewAdminUser(body)
      .then(() => {
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(null));
      })
      .catch((err) => {
        console.log('postNewAdminUser error', err);
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(err));
      });
  };
};
