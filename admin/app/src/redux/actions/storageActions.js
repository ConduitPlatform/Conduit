import {
  CLEAR_STORAGE_PAGE_STORE,
  SET_STORAGE_CONFIG,
  SET_STORAGE_ERROR,
  START_STORAGE_LOADING,
  STOP_STORAGE_LOADING,
} from './actionTypes';

export const setStorageConfig = (config) => ({
  type: SET_STORAGE_CONFIG,
  payload: config,
});

export const startStorageLoading = () => ({
  type: START_STORAGE_LOADING,
});

export const stopStorageLoading = () => ({
  type: STOP_STORAGE_LOADING,
});

export const setStorageError = (error) => ({
  type: SET_STORAGE_ERROR,
  payload: { error },
});

export const clearStoragePageStore = () => ({
  type: CLEAR_STORAGE_PAGE_STORE,
});
