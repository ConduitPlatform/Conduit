import {
  appendNewClient,
  setAvailableClients,
  setSettingsError,
  startSettingsLoading,
  stopSettingsLoading,
  deleteClientAction,
} from '../actions/settingsActions';
import {
  deleteClientRequest,
  generateNewClientRequest,
  getAvailableClientsRequest,
  putCoreRequest,
} from '../../http/requests';

export const getAvailableClients = () => {
  return (dispatch) => {
    dispatch(startSettingsLoading());
    getAvailableClientsRequest()
      .then((res) => {
        dispatch(stopSettingsLoading());
        dispatch(setAvailableClients(res.data));
        dispatch(setSettingsError(null));
      })
      .catch((err) => {
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(err));
      });
  };
};

export const generateNewClient = (platform) => {
  return (dispatch) => {
    dispatch(startSettingsLoading());
    generateNewClientRequest(platform)
      .then((res) => {
        dispatch(stopSettingsLoading());
        dispatch(appendNewClient(res.data));
        dispatch(setSettingsError(null));
      })
      .catch((err) => {
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(err));
      });
  };
};

export const deleteClient = (_id) => {
  return (dispatch) => {
    dispatch(startSettingsLoading());
    deleteClientRequest(_id)
      .then(() => {
        dispatch(stopSettingsLoading());
        dispatch(deleteClientAction(_id));
        dispatch(setSettingsError(null));
      })
      .catch((err) => {
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(err));
      });
  };
};

export const putCoreSettings = (data) => {
  return (dispatch) => {
    dispatch(startSettingsLoading());
    putCoreRequest(data)
      .then(() => {
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(null));
      })
      .catch((err) => {
        dispatch(stopSettingsLoading());
        dispatch(setSettingsError(err));
      });
  };
};
