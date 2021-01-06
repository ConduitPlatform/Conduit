import {
  APPEND_NEW_CLIENT,
  DELETE_CLIENT,
  SET_AVAILABLE_CLIENTS,
  SET_SETTINGS_ERROR,
  START_SETTINGS_LOADING,
  STOP_SETTINGS_LOADING,
} from './actionTypes';

export const setAvailableClients = (clients) => ({
  type: SET_AVAILABLE_CLIENTS,
  payload: clients,
});

export const appendNewClient = (client) => ({
  type: APPEND_NEW_CLIENT,
  payload: client,
});

export const deleteClientAction = (client) => ({
  type: DELETE_CLIENT,
  payload: client,
});

export const startSettingsLoading = () => ({
  type: START_SETTINGS_LOADING,
});

export const stopSettingsLoading = () => ({
  type: STOP_SETTINGS_LOADING,
});

export const setSettingsError = (error) => ({
  type: SET_SETTINGS_ERROR,
  payload: { error },
});
