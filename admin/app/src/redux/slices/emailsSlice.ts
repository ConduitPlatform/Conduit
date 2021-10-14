import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getEmailSettingsRequest,
  getEmailTemplateRequest,
  postEmailTemplateRequest,
  putEmailSettingsRequest,
  putEmailTemplateRequest,
  sendEmailRequest,
} from '../../http/EmailRequests';
import { EmailTemplateType, EmailSettings } from '../../models/emails/EmailModels';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';

interface IEmailSlice {
  data: {
    templateDocuments: EmailTemplateType[];
    totalCount: number;
    settings: EmailSettings;
  };
}

const initialState: IEmailSlice = {
  data: {
    templateDocuments: [],
    totalCount: 0,
    settings: {
      active: false,
      sendingDomain: '',
      transport: '',
      transportSettings: {},
    },
  },
};

export const asyncGetEmailTemplates = createAsyncThunk(
  'emails/getTemplates',
  async (params: { skip: number; limit: number }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getEmailTemplateRequest(params.skip, params.limit);

      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncSaveEmailTemplateChanges = createAsyncThunk(
  'emails/saveTemplateChanges',
  async (dataForThunk: { _id: string; data: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data: updateEmailData } = await putEmailTemplateRequest(
        dataForThunk._id,
        dataForThunk.data
      );

      thunkAPI.dispatch(
        enqueueSuccessNotification(
          `Successfully saved changes for the template ${dataForThunk.data.name}!`
        )
      );
      thunkAPI.dispatch(setAppDefaults());
      return updateEmailData.updatedTemplate;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncCreateNewEmailTemplate = createAsyncThunk(
  'emails/createNewTemplate',
  async (newEmailData: any, thunkAPI) => {
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

export const asyncSendEmail = createAsyncThunk('emails/send', async (dataToSend: any, thunkAPI) => {
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
});

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
  },
});

export default emailsSlice.reducer;
export const { clearEmailPageStore } = emailsSlice.actions;
