import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getStorageSettings, putStorageSettings } from '../../http/requests';
import { IStorageConfig } from '../../models/storage/StorageModels';

interface IStorageSlice {
  data: {
    config: IStorageConfig;
  };
  meta: {
    loading: boolean;
    error: Error | null;
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

export const asyncGetStorageConfig = createAsyncThunk('storage/getConfig', async () => {
  try {
    const { data } = await getStorageSettings();
    return data;
  } catch (error) {
    throw error;
  }
});

export const asyncSaveStorageConfig = createAsyncThunk(
  'storage/saveConfig',
  async (dataForConfig: IStorageConfig) => {
    try {
      const { data } = await putStorageSettings(dataForConfig);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    clearStoragePageStore(state) {
      state = initialState;
    },
    setStorageLoading(state, action) {
      state.meta.loading = action.payload;
    },
    setStorageError(state, action) {
      state.meta.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetStorageConfig.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetStorageConfig.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetStorageConfig.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.config = action.payload;
    });
    builder.addCase(asyncSaveStorageConfig.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncSaveStorageConfig.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncSaveStorageConfig.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.config = action.payload;
    });
  },
});

export const {
  setStorageLoading,
  setStorageError,
  clearStoragePageStore,
} = storageSlice.actions;

export default storageSlice.reducer;
