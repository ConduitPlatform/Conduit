import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import {
  createForm,
  getFormReplies,
  getForms,
  getFormsConfig,
  updateForm,
  updateFormsConfig,
} from '../../http/FormsRequests';
import { FormReplies, FormSettingsConfig, FormsModel } from '../../models/forms/FormsModels';

export type FormsState = {
  data: {
    forms: FormsModel[];
    count: number;
    replies: FormReplies[];
    config: FormSettingsConfig;
  };
};

const initialState: FormsState = {
  data: {
    forms: [],
    count: 0,
    replies: [],
    config: { active: false, useAttachments: false },
  },
};

export const asyncGetForms = createAsyncThunk('forms/get', async (args, thunkAPI) => {
  thunkAPI.dispatch(setAppLoading(true));
  try {
    const { data } = await getForms();
    thunkAPI.dispatch(setAppDefaults());
    return data;
  } catch (error) {
    thunkAPI.dispatch(enqueueErrorNotification(`Could not get forms data:${getErrorData(error)}`));
    thunkAPI.dispatch(setAppLoading(false));
    throw error;
  }
});

export const asyncCreateForm = createAsyncThunk(
  'forms/create',
  async (formData: FormsModel, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createForm(formData);
      thunkAPI.dispatch(setAppDefaults());

      return data;
    } catch (error) {
      thunkAPI.dispatch(
        enqueueErrorNotification(`Could not create a new form:${getErrorData(error)}`)
      );
      thunkAPI.dispatch(setAppLoading(false));
      throw error;
    }
  }
);

export const asyncGetFormReplies = createAsyncThunk(
  'forms/replies',
  async (args: { id: string }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getFormReplies(args.id);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(
        enqueueErrorNotification(`Could not get form replies:${getErrorData(error)}`)
      );
      thunkAPI.dispatch(setAppLoading(false));
      throw error;
    }
  }
);

export const asyncEditForm = createAsyncThunk(
  'forms/edit',
  async (args: { _id: string; data: FormsModel }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await updateForm(args._id, args.data);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(enqueueErrorNotification(`Could not update form:${getErrorData(error)}`));
      thunkAPI.dispatch(setAppLoading(false));
      throw error;
    }
  }
);

export const asyncGetFormsConfig = createAsyncThunk('formsConfig/get', async (args, thunkAPI) => {
  thunkAPI.dispatch(setAppLoading(true));
  try {
    const { data } = await getFormsConfig();
    thunkAPI.dispatch(setAppDefaults());
    return data;
  } catch (error) {
    thunkAPI.dispatch(
      enqueueErrorNotification(`Could not get the forms config:${getErrorData(error)}`)
    );
    thunkAPI.dispatch(setAppLoading(false));
    throw error;
  }
});

export const asyncEditFormsConfig = createAsyncThunk(
  'formsConfig/edit',
  async (config: FormSettingsConfig, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await updateFormsConfig(config);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(
        enqueueErrorNotification(`Could not update the config:${getErrorData(error)}`)
      );
      thunkAPI.dispatch(setAppLoading(false));
      throw error;
    }
  }
);

const formsSlice = createSlice({
  name: 'forms',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(asyncGetForms.fulfilled, (state, action) => {
      state.data.forms = action.payload.forms;
      state.data.count = action.payload.count;
    });
    builder.addCase(asyncCreateForm.fulfilled, (state, action) => {
      state.data.forms = action.payload.forms;
      state.data.count = action.payload.count;
    });
    builder.addCase(asyncGetFormReplies.fulfilled, (state, action) => {
      state.data.replies = action.payload;
    });
    builder.addCase(asyncGetFormsConfig.fulfilled, (state, action) => {
      state.data.config = action.payload;
    });
    builder.addCase(asyncEditFormsConfig.fulfilled, (state, action) => {
      state.data.config = action.payload;
    });
  },
});

export default formsSlice.reducer;
