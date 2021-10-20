import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { IStorageConfig } from '../../models/storage/StorageModels';
import {
  createStorageFile,
  getStorageSettings,
  putStorageSettings,
} from '../../http/StorageRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import { base64example } from '../../assets/svgs/ExampleBase64';

interface IStorageSlice {
  data: {
    config: IStorageConfig;
  };
}

const initialState: IStorageSlice = {
  data: {
    config: {
      active: false,
      provider: '',
      storagePath: '',
      allowContainerCreation: true,
      defaultContainer: '',
      azure: {
        connectionString: '',
      },
      google: {
        serviceAccountKeyPath: '',
        bucketName: '',
      },
    },
  },
};

export const asyncGetStorageConfig = createAsyncThunk(
  'storage/getConfig',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getStorageSettings();
      thunkAPI.dispatch(setAppDefaults());
      console.log('config-data', data);
      return data;
    } catch (error) {
      console.log('config-error');
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncSaveStorageConfig = createAsyncThunk(
  'storage/saveConfig',
  async (dataForConfig: IStorageConfig, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await putStorageSettings(dataForConfig);
      thunkAPI.dispatch(setAppDefaults());
      console.log('saveConfig data', data);
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      console.log('saveConfig error', error);
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncAddStorageFile = createAsyncThunk(
  'storage/addStorageFile',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const fileData = {
        name: 'example',
        data: base64example,
        // folder: 'conduit',
        // container: 'conduit',
        // mimeType: any,
        // isPublic: any,
      };

      const { data } = await createStorageFile(fileData);
      console.log('success', data);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      console.log('error', error);
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    clearStoragePageStore: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetStorageConfig.fulfilled, (state, action) => {
      state.data.config = action.payload;
    });
    builder.addCase(asyncSaveStorageConfig.fulfilled, (state, action) => {
      state.data.config = action.payload;
    });
  },
});

export const { clearStoragePageStore } = storageSlice.actions;

export default storageSlice.reducer;
