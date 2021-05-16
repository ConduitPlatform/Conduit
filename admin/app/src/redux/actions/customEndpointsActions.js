import {
  ENDPOINT_CLEAN_SLATE,
  SET_ENDPOINT_DATA,
  SET_SCHEMA_FIELDS,
  SET_SELECTED_ENDPOINT,
} from './actionTypes';

export const setSelectedEndpoint = (data) => ({
  type: SET_SELECTED_ENDPOINT,
  payload: data,
});

export const setEndpointData = (data) => ({
  type: SET_ENDPOINT_DATA,
  payload: data,
});

export const setSchemaFields = (data) => ({
  type: SET_SCHEMA_FIELDS,
  payload: data,
});

export const endpointCleanSlate = () => ({
  type: ENDPOINT_CLEAN_SLATE,
});
