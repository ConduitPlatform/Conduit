import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getNotificationConfig,
  putNotificationConfig,
  sendNotification,
} from '../../http/requests';
import {
  INotificationSettings,
  NotificationData,
} from '../../models/notifications/NotificationModels';

interface INotificationSlice {
  data: {
    config: INotificationSettings;
    notifications: NotificationData;
  };
  meta: {
    loading: boolean;
    error: string | null;
  };
}

const initialState: INotificationSlice = {
  data: { config: null, notifications: null },
  meta: {
    loading: false,
    error: null,
  },
};

const asyncSendNewNotification = createAsyncThunk(
  'notifications/sendNew',
  async (data) => {
    try {
      const sentNotifications = await sendNotification(data);
      return sentNotifications;
    } catch (error) {
      throw error;
    }
  }
);

const asyncGetNotificationConfig = createAsyncThunk(
  'notifications/getConfig',
  async () => {
    try {
      const config = await getNotificationConfig();
      return config;
    } catch (error) {
      throw error;
    }
  }
);

const asyncSaveNotificationConfig = createAsyncThunk(
  'notifications/saveConfig',
  async () => {
    try {
      const savedConfig = await putNotificationConfig();
      return savedConfig;
    } catch (error) {
      throw error;
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearNotificationPageStore(state) {
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
    builder.addCase(asyncSendNewNotification.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncSendNewNotification.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncSendNewNotification.fulfilled, (state) => {
      state.meta.loading = false;
    });
    builder.addCase(asyncGetNotificationConfig.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetNotificationConfig.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncGetNotificationConfig.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.config = action.payload;
    });
    builder.addCase(asyncSaveNotificationConfig.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncSaveNotificationConfig.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncSaveNotificationConfig.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.config = action.payload;
    });
  },
});

export {
  asyncGetNotificationConfig,
  asyncSaveNotificationConfig,
  asyncSendNewNotification,
};

export default notificationsSlice.reducer;
export const { clearNotificationPageStore, setLoading } = notificationsSlice.actions;
