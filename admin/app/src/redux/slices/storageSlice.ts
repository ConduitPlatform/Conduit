import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getStorageSettings, putStorageSettings } from '../../http/requests';

import { IStorageConfig } from './../../models/storage/StorageModels';

interface IStorageSlice {
  data: {
    config: IStorageConfig;
  };
  meta: {
    loading: boolean;
    error: string | null;
  };
}

const initialState: IStorageSlice = {
  data: {
    config: {
      active: false,
      provider: '',
      storagePath: '',
      azure: {
        connectionString: '',
      },
      google: {
        serviceAccountKeyPath: '',
        bucketName: '',
      },
    },
  },
  meta: {
    loading: false,
    error: null,
  },
};

const asyncGetStorageConfig = createAsyncThunk('storage/getConfig', async () => {
  try {
    const storageSettings = await getStorageSettings();
    return storageSettings;
  } catch (error) {
    throw error;
  }
});

const asyncSaveStorageConfig = createAsyncThunk('storage/saveConfig', async (data) => {
  try {
    const config = await putStorageSettings(data);
    return config;
  } catch (error) {
    throw error;
  }
});

const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    clearStoragePageStore(state) {
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
    builder.addCase(asyncGetStorageConfig.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetStorageConfig.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncGetStorageConfig.fulfilled, (state) => {
      state.meta.loading = false;
    });
    builder.addCase(asyncSaveStorageConfig.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncSaveStorageConfig.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.payload;
    });
    builder.addCase(asyncSaveStorageConfig.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
  },
});

export { asyncGetStorageConfig, asyncSaveStorageConfig };

export default storageSlice.reducer;
export const { setLoading, setError, clearStoragePageStore } = storageSlice.actions;
