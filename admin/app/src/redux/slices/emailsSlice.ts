import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  deleteEmailTemplateRequest,
  getEmailSettingsRequest,
  getEmailTemplateRequest,
  getExternalTemplatesRequest,
  postEmailTemplateRequest,
  putEmailSettingsRequest,
  putEmailTemplateRequest,
  sendEmailRequest,
  syncExternalTemplates,
  uploadTemplateRequest,
} from '../../http/EmailRequests';
import {
  EmailTemplateType,
  EmailSettings,
  EmailData,
  SendEmailData,
  TransportProviders,
} from '../../models/emails/EmailModels';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';
import { Pagination } from '../../http/types/Pagination';
import { Search } from '../../http/types/Search';

interface IEmailSlice {
  data: {
    templateDocuments: EmailTemplateType[];
    totalCount: number;
    settings: EmailSettings;
    externalTemplates: EmailTemplateType[];
  };
}

const initialState: IEmailSlice = {
  data: {
    templateDocuments: [],
    totalCount: 0,
    settings: {
      active: false,
      sendingDomain: '',
      transport: TransportProviders['smtp'],
      transportSettings: {
        mailgun: {
          apiKey: '',
          domain: '',
          host: '',
        },
        smtp: {
          port: '',
          host: '',
          auth: {
            username: '',
            password: '',
            method: '',
          },
        },
        mandrill: {
          apiKey: '',
        },
        sendgrid: {
          apiUser: '',
        },
      },
    },
    externalTemplates: [],
  },
};

export const asyncGetEmailTemplates = createAsyncThunk(
  'emails/getTemplates',
  async (params: Pagination & Search, thunkAPI) => {
    try {
      const { data } = await getEmailTemplateRequest(params);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetExternalTemplates = createAsyncThunk(
  'emails/getExternalTemplates',
  async (params, thunkAPI) => {
    try {
      const { data } = await getExternalTemplatesRequest();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncUploadTemplate = createAsyncThunk(
  'emails/uploadTemplate',
  async (_id: string, thunkAPI) => {
    try {
      await uploadTemplateRequest(_id);
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Email template was uploaded successfully!'));
      return _id;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncSaveEmailTemplateChanges = createAsyncThunk(
  'emails/saveTemplateChanges',
  async (dataForThunk: { _id: string; data: EmailData }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const {
        data: { updatedTemplate: updateEmailData },
      } = await putEmailTemplateRequest(dataForThunk._id, dataForThunk.data);
      thunkAPI.dispatch(
        enqueueSuccessNotification(
          `Successfully saved changes for the template ${dataForThunk.data.name}!`
        )
      );
      thunkAPI.dispatch(setAppDefaults());
      return updateEmailData;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncCreateNewEmailTemplate = createAsyncThunk(
  'emails/createNewTemplate',
  async (newEmailData: EmailData, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await postEmailTemplateRequest(newEmailData);
      thunkAPI.dispatch(
        enqueueSuccessNotification(`Successfully created template ${newEmailData.name}!`)
      );
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncSyncTemplates = createAsyncThunk(
  'emails/deleteTemplate',
  async (params, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await syncExternalTemplates();
      thunkAPI.dispatch(enqueueSuccessNotification(`Successfully synced templates!`));
      thunkAPI.dispatch(setAppDefaults());
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteTemplates = createAsyncThunk(
  'emails/deleteMultipleTemplates',
  async (params: { ids: string[]; getTemplates: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteEmailTemplateRequest(params.ids);
      params.getTemplates();
      thunkAPI.dispatch(enqueueSuccessNotification(`Successfully deleted templates!`));
      thunkAPI.dispatch(setAppDefaults());
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);
export const asyncGetEmailSettings = createAsyncThunk(
  'emails/getEmailSettings',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getEmailSettingsRequest();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncUpdateEmailSettings = createAsyncThunk(
  'emails/updateSettings',
  async (updatedSettings: EmailSettings, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await putEmailSettingsRequest(updatedSettings);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncSendEmail = createAsyncThunk(
  'emails/send',
  async (dataToSend: SendEmailData, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await sendEmailRequest(dataToSend);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

const updateTemplateByID = (updated: EmailTemplateType, templates: EmailTemplateType[]) => {
  return templates.map((t) => {
    if (t._id === updated._id) {
      return {
        ...updated,
      };
    } else {
      return t;
    }
  });
};

const emailsSlice = createSlice({
  name: 'emails',
  initialState,
  reducers: {
    clearEmailPageStore: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetEmailTemplates.fulfilled, (state, action) => {
      state.data.templateDocuments = action.payload.templateDocuments;
      state.data.totalCount = action.payload.totalCount;
    });

    builder.addCase(asyncGetExternalTemplates.fulfilled, (state, action) => {
      state.data.externalTemplates = action.payload.templateDocuments;
    });
    builder.addCase(asyncSaveEmailTemplateChanges.fulfilled, (state, action) => {
      state.data.templateDocuments = updateTemplateByID(
        action.payload,
        state.data.templateDocuments
      );
    });
    builder.addCase(asyncCreateNewEmailTemplate.fulfilled, (state, action) => {
      state.data.templateDocuments.push(action.payload.template);
      state.data.totalCount = state.data.totalCount++;
    });
    builder.addCase(asyncGetEmailSettings.fulfilled, (state, action) => {
      state.data.settings = action.payload;
    });
    builder.addCase(asyncUpdateEmailSettings.fulfilled, (state, action) => {
      state.data.settings = action.payload;
    });
    builder.addCase(asyncSendEmail.fulfilled, () => {
      //handle success
    });
    builder.addCase(asyncUploadTemplate.fulfilled, (state, action) => {
      const templateToUpdate = state.data.templateDocuments.find(
        (template) => template._id === action.payload
      );
      if (templateToUpdate !== undefined) templateToUpdate.externalManaged = true;
    });
  },
});

export default emailsSlice.reducer;
export const { clearEmailPageStore } = emailsSlice.actions;
