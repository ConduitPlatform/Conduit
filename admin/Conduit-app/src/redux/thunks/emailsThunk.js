import {
  addEmailTemplate,
  setEmailsError,
  setEmailSettings,
  setEmailTemplates,
  startEmailsLoading,
  stopEmailsLoading,
  updateEmailTemplates,
} from '../actions/emailsActions';
import {
  getEmailSettingsRequest,
  getEmailTemplateRequest,
  postEmailTemplateRequest,
  putEmailSettingsRequest,
  putEmailTemplateRequest,
  sendEmailRequest,
} from '../../http/requests';

export const getEmailTemplates = () => {
  return (dispatch) => {
    dispatch(startEmailsLoading());
    getEmailTemplateRequest()
      .then((res) => {
        dispatch(setEmailTemplates(res.data));
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(null));
      })
      .catch((err) => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(err));
      });
    dispatch(stopEmailsLoading);
  };
};

export const saveEmailTemplateChanges = (_id, data) => {
  return (dispatch) => {
    dispatch(startEmailsLoading());
    putEmailTemplateRequest(_id, data)
      .then((res) => {
        dispatch(updateEmailTemplates(res.data.updatedTemplate));
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(null));
      })
      .catch((err) => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(err));
      });
  };
};

export const createNewEmailTemplate = (data) => {
  return (dispatch) => {
    dispatch(startEmailsLoading());
    postEmailTemplateRequest(data)
      .then((res) => {
        dispatch(addEmailTemplate(res.data.template));
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(null));
      })
      .catch((err) => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(err));
      });
  };
};

export const getEmailSettings = () => {
  return (dispatch) => {
    dispatch(startEmailsLoading());
    getEmailSettingsRequest()
      .then((res) => {
        dispatch(setEmailSettings(res.data));
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(null));
      })
      .catch((err) => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(err));
      });
  };
};

export const updateEmailSettings = () => {
  return (dispatch) => {
    dispatch(startEmailsLoading());
    putEmailSettingsRequest()
      .then((res) => {
        dispatch(setEmailSettings(res.data));
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(null));
      })
      .catch((err) => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(err));
      });
  };
};

export const sendEmailThunk = (data) => {
  return (dispatch) => {
    dispatch(startEmailsLoading());
    sendEmailRequest(data)
      .then(() => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(null));
      })
      .catch((err) => {
        dispatch(stopEmailsLoading());
        dispatch(setEmailsError(err));
      });
  };
};
