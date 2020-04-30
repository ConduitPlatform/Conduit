import {
  ADD_EMAIL_TEMPLATE,
  SET_EMAIL_ERROR,
  SET_EMAIL_SETTINGS,
  SET_EMAIL_TEMPLATES,
  START_EMAIL_LOADING,
  STOP_EMAIL_LOADING,
  UPDATE_EMAIL_TEMPLATE,
} from './actionTypes';

export const setEmailTemplates = (data) => ({
  type: SET_EMAIL_TEMPLATES,
  payload: data,
});

export const startEmailsLoading = () => ({
  type: START_EMAIL_LOADING,
});

export const stopEmailsLoading = () => ({
  type: STOP_EMAIL_LOADING,
});

export const setEmailsError = (error) => ({
  type: SET_EMAIL_ERROR,
  payload: { error },
});

export const updateEmailTemplates = (data) => ({
  type: UPDATE_EMAIL_TEMPLATE,
  payload: data,
});

export const addEmailTemplate = (data) => ({
  type: ADD_EMAIL_TEMPLATE,
  payload: data,
});

export const setEmailSettings = (data) => ({
  type: SET_EMAIL_SETTINGS,
  payload: data,
});
