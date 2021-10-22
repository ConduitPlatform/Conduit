import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { IContainer, IStorageConfig } from '../../models/storage/StorageModels';
import {
  createStorageContainer,
  createStorageFile,
  createStorageFolder,
  deleteStorageFile,
  getStorageContainers,
  getStorageFile,
  getStorageFiles,
  getStorageFolders,
  getStorageSettings,
  putStorageSettings,
  updateStorageFile,
} from '../../http/StorageRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification } from '../../utils/useNotifier';
import { base64example } from '../../assets/svgs/ExampleBase64';

interface IStorageSlice {
  data: {
    config: IStorageConfig;
    containers: {
      containers: IContainer[];
      containersCount: number;
    };
    folders: any;
    files: any;
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
    containers: {
      containers: [],
      containersCount: 0,
    },
    folders: [],
    files: [],
  },
};

export const asyncGetStorageConfig = createAsyncThunk(
  'storage/getConfig',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getStorageSettings();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
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
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetStorageContainers = createAsyncThunk(
  'storage/getStorageContainers',
  async (
    params: {
      skip: number;
      limit: number;
    },
    thunkAPI
  ) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getStorageContainers(params);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetStorageFolders = createAsyncThunk(
  'storage/getStorageFolders',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const params = {
        skip: 0,
        limit: 10,
        container: 'conduit',
        // parent:
      };
      const { data } = await getStorageFolders(params);
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

export const asyncGetStorageFiles = createAsyncThunk(
  'storage/getStorageFiles',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const params = {
        skip: 0,
        limit: 10,
        // folder: 'conduit';
        container: 'conduit',
      };
      const { data } = await getStorageFiles(params);
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

export const asyncAddStorageFile = createAsyncThunk(
  'storage/addStorageFile',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const fileData = {
        name: 'example',
        data: base64example,
        folder: 'test-folder',
        container: 'conduit',
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

export const asyncAddStorageFolder = createAsyncThunk(
  'storage/addStorageFolder',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const folderData = {
        name: 'test-folder',
        container: 'conduit',
        isPublic: false,
      };
      const { data } = await createStorageFolder(folderData);
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

export const asyncAddStorageContainer = createAsyncThunk(
  'storage/addStorageContainer',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const containerData = {
        name: 'test-container-2',
        isPublic: false,
      };
      const { data } = await createStorageContainer(containerData);
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

export const asyncGetStorageFile = createAsyncThunk(
  'storage/getStorageFile',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const fileId = '61714e908afe4116b6882ea9';
      const { data } = await getStorageFile(fileId);
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

export const asyncDeleteStorageFile = createAsyncThunk(
  'storage/deleteStorageFile',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const fileId = '617158368afe4116b6882eb0';
      const { data } = await deleteStorageFile(fileId);
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

export const asyncUpdateStorageFile = createAsyncThunk(
  'storage/updateStorageFile',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const fileData = {
        id: '617158368afe4116b6882eb0',
        name: 'new-example-file',
        folder: 'test-folder',
        container: 'conduit',
        data: base64example,
      };
      const { data } = await updateStorageFile(fileData);
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
    builder.addCase(asyncGetStorageContainers.fulfilled, (state, action) => {
      state.data.containers = action.payload;
    });
  },
});

export const { clearStoragePageStore } = storageSlice.actions;

export default storageSlice.reducer;
