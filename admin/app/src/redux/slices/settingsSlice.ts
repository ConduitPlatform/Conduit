import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  deleteClientRequest,
  generateNewClientRequest,
  getNotificationConfig,
  putCoreRequest,
  putNotificationConfig,
  sendNotification,
} from '../../http/requests';
import {
  INotificationSettings,
  NotificationData,
} from '../../models/notifications/NotificationModels';
import { getAvailableClients } from '../thunks/settingsThunks';
import { IClient } from './../../models/settings/SettingsModels';

interface INotificationSlice {
  data: {
    availableClients: IClient[];
  };
  meta: {
    loading: boolean;
    error: string | null;
  };
}

const initialState: INotificationSlice = {
  data: { availableClients: [] },
  meta: {
    loading: false,
    error: null,
  },
};

const asyncGetAvailableClients = createAsyncThunk('notifications/sendNew', async () => {
  try {
    const clients = await getAvailableClients();
    return clients;
  } catch (error) {
    throw error;
  }
});

const asyncGenerateNewClient = createAsyncThunk(
  'settings/generateClient',
  async (platform) => {
    try {
      const newClient = await generateNewClientRequest(platform);
      return newClient;
    } catch (error) {
      throw error;
    }
  }
);

const asyncDeleteClient = createAsyncThunk('settings/deleteClient', async (id) => {
  try {
    const deletedClient = await deleteClientRequest(id);
    return deletedClient;
  } catch (error) {
    throw error;
  }
});

const asyncPutCoreSettings = createAsyncThunk('settings/saveConfig', async (data) => {
  try {
    const savedConfig = await putCoreRequest(data);
    return savedConfig;
  } catch (error) {
    throw error;
  }
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLoading(state, action) {
      state.meta.loading = action.payload;
    },
    setError(state, action) {
      state.meta.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetAvailableClients.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetAvailableClients.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncGetAvailableClients.fulfilled, (state) => {
      state.meta.loading = false;
      //  TODO state.data.availableClients = action.payload;
    });
    builder.addCase(asyncGenerateNewClient.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGenerateNewClient.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncGenerateNewClient.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      //  TODO state.data.availableClients = action.payload;
    });
    builder.addCase(asyncDeleteClient.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncDeleteClient.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncDeleteClient.fulfilled, (state, action) => {
      state.meta.loading = false;
      //  TODO  state.data.availableClients =
    });
    builder.addCase(asyncPutCoreSettings.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncPutCoreSettings.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncPutCoreSettings.fulfilled, (state, action) => {
      state.meta.loading = true;
    });
  },
});

export {
  asyncGetAvailableClients,
  asyncGenerateNewClient,
  asyncDeleteClient,
  asyncPutCoreSettings,
};

export default settingsSlice.reducer;
export const { setLoading, setError } = settingsSlice.actions;
