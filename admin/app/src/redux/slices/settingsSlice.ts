import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  deleteClientRequest,
  generateNewClientRequest,
  getAvailableClientsRequest,
  putCoreRequest,
} from '../../http/requests';
import { IClient, IPlatformTypes } from './../../models/settings/SettingsModels';

interface INotificationSlice {
  data: {
    availableClients: IClient[];
  };
  meta: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: INotificationSlice = {
  data: { availableClients: [] },
  meta: {
    loading: false,
    error: null,
  },
};

export const asyncGetAvailableClients = createAsyncThunk(
  'notifications/getClients',
  async () => {
    try {
      const { data } = await getAvailableClientsRequest();
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGenerateNewClient = createAsyncThunk(
  'settings/generateClient',
  async (platform: IPlatformTypes) => {
    try {
      const { data } = await generateNewClientRequest(platform);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncDeleteClient = createAsyncThunk(
  'settings/deleteClient',
  async (_id: string) => {
    try {
      await deleteClientRequest(_id);
      return _id;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncPutCoreSettings = createAsyncThunk(
  'settings/saveConfig',
  async (data) => {
    try {
      const savedConfig = await putCoreRequest(data);
      return savedConfig;
    } catch (error) {
      throw error;
    }
  }
);

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
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetAvailableClients.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.availableClients = action.payload;
    });
    builder.addCase(asyncGenerateNewClient.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGenerateNewClient.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGenerateNewClient.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.availableClients.push(action.payload);
    });
    builder.addCase(asyncDeleteClient.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncDeleteClient.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncDeleteClient.fulfilled, (state, action) => {
      state.meta.loading = false;
      const allClients = state.data.availableClients;
      const clientIndex = allClients.findIndex((c) => c._id === action.payload);
      if (clientIndex !== -1) {
        allClients.splice(clientIndex, 1);
      }
    });
    builder.addCase(asyncPutCoreSettings.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncPutCoreSettings.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncPutCoreSettings.fulfilled, (state, action) => {
      state.meta.loading = true;
    });
  },
});

export default settingsSlice.reducer;
export const { setLoading, setError } = settingsSlice.actions;
