import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getEmailSettingsRequest,
  getEmailTemplateRequest,
  postEmailTemplateRequest,
  putEmailSettingsRequest,
  putEmailTemplateRequest,
  sendEmailRequest,
} from '../../http/requests';
import { EmailTemplateType, EmailSettings } from './../../models/emails/EmailModels';

interface IEmailSlice {
  data: {
    templateDocuments: EmailTemplateType[];
    totalCount: number;
    settings: EmailSettings;
  };
  meta: {
    loading: boolean;
    error: Error | null;
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
  meta: {
    loading: false,
    error: null,
  },
};

export const asyncGetEmailTemplates = createAsyncThunk(
  'emails/getTemplates',
  async () => {
    try {
      const { data } = await getEmailTemplateRequest();
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncSaveEmailTemplateChanges = createAsyncThunk(
  'emails/saveTemplateChanges',
  async (dataForThunk: { _id: string; data: any }) => {
    try {
      const { data: updateEmailData } = await putEmailTemplateRequest(
        dataForThunk._id,
        dataForThunk.data
      );
      return updateEmailData;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncCreateNewEmailTemplate = createAsyncThunk(
  'emails/createNewTemplate',
  async (newEmailData: any) => {
    try {
      const { data } = await postEmailTemplateRequest(newEmailData);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetEmailSettings = createAsyncThunk(
  'emails/getEmailSettings',
  async () => {
    try {
      const { data } = await getEmailSettingsRequest();
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncUpdateEmailSettings = createAsyncThunk(
  'emails/updateSettings',
  async (updatedSettings: any) => {
    try {
      const { data } = await putEmailSettingsRequest(updatedSettings);

      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncSendEmail = createAsyncThunk('emails/send', async (dataToSend: any) => {
  try {
    const { data } = await sendEmailRequest(dataToSend);
    return data;
  } catch (error) {
    throw error;
  }
});

const updateTemplateByID = (
  updated: EmailTemplateType,
  templates: EmailTemplateType[]
) => {
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
    clearEmailPageStore(state) {
      state = initialState;
    },
    setLoading(state, action) {
      state.meta.loading = action.payload;
    },
    setError(state, action) {
      state.meta.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetEmailTemplates.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetEmailTemplates.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetEmailTemplates.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.templateDocuments = action.payload.templateDocuments;
      state.data.totalCount = action.payload.totalCount;
    });
    builder.addCase(asyncSaveEmailTemplateChanges.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncSaveEmailTemplateChanges.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncSaveEmailTemplateChanges.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.templateDocuments = updateTemplateByID(
        action.payload,
        state.data.templateDocuments
      );
    });
    builder.addCase(asyncCreateNewEmailTemplate.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncCreateNewEmailTemplate.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncCreateNewEmailTemplate.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.templateDocuments.push(action.payload.template);
      state.data.totalCount === state.data.totalCount++;
    });
    builder.addCase(asyncGetEmailSettings.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetEmailSettings.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetEmailSettings.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.settings = action.payload;
    });
    builder.addCase(asyncUpdateEmailSettings.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncUpdateEmailSettings.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncUpdateEmailSettings.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.settings = action.payload;
    });
    builder.addCase(asyncSendEmail.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncSendEmail.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncSendEmail.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
  },
});

export default emailsSlice.reducer;
export const { clearEmailPageStore, setLoading, setError } = emailsSlice.actions;
