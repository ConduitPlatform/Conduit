import {
  setStorageError,
  startStorageLoading,
  stopStorageLoading,
  setStorageConfig,
} from '../actions';
import { getStorageSettings, putStorageSettings } from '../../http/requests';

export const getStorageConfig = () => {
  return (dispatch) => {
    dispatch(startStorageLoading());
    getStorageSettings()
      .then((res) => {
        dispatch(stopStorageLoading());
        dispatch(setStorageConfig(res.data));
        dispatch(setStorageError(null));
      })
      .catch((error) => {
        dispatch(stopStorageLoading());
        dispatch(setStorageError(error));
      });
  };
};

export const saveStorageConfig = (data) => {
  return (dispatch) => {
    dispatch(startStorageLoading());
    putStorageSettings(data)
      .then((res) => {
        dispatch(stopStorageLoading());
        dispatch(setStorageConfig(res.data));
        dispatch(setStorageError(null));
      })
      .catch((error) => {
        dispatch(stopStorageLoading());
        dispatch(setStorageError(error));
      });
  };
};
