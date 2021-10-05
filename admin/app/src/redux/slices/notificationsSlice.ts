import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  INotificationSettings,
  NotificationData,
} from '../../models/notifications/NotificationModels';
import {
  sendNotification,
  getNotificationConfig,
  putNotificationConfig,
} from '../../http/NotificationsRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { notify } from 'reapop';

interface INotificationSlice {
  data: {
    config: INotificationSettings;
    notifications: NotificationData[];
  };
}

const initialState: INotificationSlice = {
  data: {
    config: {
      active: false,
      providerName: '',
      projectId: '',
      privateKey: '',
      clientEmail: '',
      message: '',
    },
    notifications: [],
  },
};

export const asyncSendNewNotification = createAsyncThunk(
  'notifications/sendNew',
  async (data: NotificationData, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await sendNotification(data);
      thunkAPI.dispatch(setAppDefaults());
      return;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncGetNotificationConfig = createAsyncThunk(
  'notifications/getConfig',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getNotificationConfig();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncSaveNotificationConfig = createAsyncThunk(
  'notifications/saveConfig',
  async (settings: INotificationSettings, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await putNotificationConfig({
        projectId: settings.projectId,
        privateKey: settings.privateKey,
        clientEmail: settings.clientEmail,
      });
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationPageStore: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetNotificationConfig.fulfilled, (state, action) => {
      state.data.config = action.payload;
    });
    builder.addCase(asyncSaveNotificationConfig.fulfilled, (state, action) => {
      state.data.config = action.payload;
    });
  },
});

export const { clearNotificationPageStore } = notificationsSlice.actions;

export default notificationsSlice.reducer;
