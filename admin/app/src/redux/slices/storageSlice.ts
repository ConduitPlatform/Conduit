import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { IContainer, IStorageConfig } from '../../models/storage/StorageModels';
import {
  createStorageContainer,
  createStorageFile,
  createStorageFolder,
  deleteStorageContainer,
  deleteStorageFile,
  deleteStorageFolder,
  getStorageContainers,
  getStorageFile,
  getStorageFiles,
  getStorageFileUrl,
  getStorageFolders,
  getStorageSettings,
  putStorageSettings,
  updateStorageFile,
} from '../../http/StorageRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';
import { base64example } from '../../assets/svgs/ExampleBase64';
import { concat } from 'lodash';

interface IStorageSlice {
  data: {
    config: IStorageConfig;
    containers: {
      containers: IContainer[];
      containersCount: number;
    };
    containerData: {
      data: any;
      totalCount: number;
    };
    selectedFile: undefined;
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
    containerData: {
      totalCount: 0,
      data: [],
    },
    selectedFile: undefined,
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

export const asyncGetStorageContainerData = createAsyncThunk(
  'storage/getStorageContainerData',
  async (params: { skip: number; limit: number; container: string; folder: string }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const folderParams = {
        skip: params.skip,
        limit: params.limit,
        container: params.container,
        parent: params.folder ? params.folder : undefined,
      };
      const { data: folderData } = await getStorageFolders(folderParams);
      console.log('folderData', folderData);
      const folderLength = folderData.folders.length;

      let fileSkip = 0;
      let fileLimit = 10;
      if (folderLength <= params.limit) {
        fileLimit = params.limit - folderLength;
      }
      if (folderLength <= params.skip) {
        fileSkip = params.skip - folderLength;
      }

      const fileParams = {
        skip: fileSkip,
        limit: fileLimit,
        folder: params.folder ? params.folder : undefined,
        container: params.container,
      };
      const { data: fileData } = await getStorageFiles(fileParams);
      const newFileData = fileData.files.map((file: any) => {
        return Object.assign(file, { isFile: true });
      });

      const totalCount = folderData.folderCount + fileData.filesCount;

      thunkAPI.dispatch(setAppDefaults());
      if (fileLimit < 1) {
        return { data: folderData.folders, totalCount: totalCount };
      }
      return { data: concat(folderData.folders, newFileData), totalCount: totalCount };
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
  async ({ fileData, getContainerData }: any, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createStorageFile(fileData);
      getContainerData();
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully added file!'));
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncAddStorageFolder = createAsyncThunk(
  'storage/addStorageFolder',
  async (folderData: { name: string; container: string; isPublic: boolean }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createStorageFolder(folderData);
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully added folder!'));
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncAddStorageContainer = createAsyncThunk(
  'storage/addStorageContainer',
  async (containerData: { name: string; isPublic: boolean }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createStorageContainer(containerData);
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully added container!'));
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncGetStorageFile = createAsyncThunk(
  'storage/getStorageFile',
  async (id: string, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getStorageFile(id);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteStorageFile = createAsyncThunk(
  'storage/deleteStorageFile',
  async (fileId: string, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteStorageFile(fileId);
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully deleted file!'));
      return fileId;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteStorageFolder = createAsyncThunk(
  'storage/deleteStorageFolder',
  async (params: { id: string; name: string; container: string }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteStorageFolder(params);
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully deleted folder!'));
      return params.id;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteStorageContainer = createAsyncThunk(
  'storage/deleteStorageContainer',
  async (params: { id: string; name: string }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteStorageContainer(params);
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully deleted container!'));
      return params.id;
    } catch (error) {
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
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully updated file!'));
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

export const asyncSetSelectedStorageFile = createAsyncThunk(
  'storage/setSelectedStorageFile',
  async (file: any, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      console.log('file', file);
      if (!file.url) {
        const { data } = await getStorageFileUrl(file._id);
        console.log('data', data);
      }
      // const { data } = await updateStorageFile(fileData);
      // thunkAPI.dispatch(enqueueSuccessNotification('Successfully updated file!'));
      // console.log('success', data);
      thunkAPI.dispatch(setAppDefaults());
      // return data;
    } catch (error) {
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
    setSelectedFile: (state, action) => {
      state.data.selectedFile = action.payload;
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
    builder.addCase(asyncGetStorageContainerData.fulfilled, (state, action) => {
      state.data.containerData = action.payload;
    });
    builder.addCase(asyncDeleteStorageFile.fulfilled, (state, action) => {
      const foundIndex = state.data.containerData.data.findIndex(
        (item: any) => item._id === action.payload
      );
      if (foundIndex !== -1) state.data.containerData.data.splice(foundIndex, 1);
    });
    builder.addCase(asyncDeleteStorageFolder.fulfilled, (state, action) => {
      const foundIndex = state.data.containerData.data.findIndex(
        (item: any) => item._id === action.payload
      );
      if (foundIndex !== -1) state.data.containerData.data.splice(foundIndex, 1);
    });
    builder.addCase(asyncDeleteStorageContainer.fulfilled, (state, action) => {
      const foundIndex = state.data.containers.containers.findIndex(
        (item: any) => item._id === action.payload
      );
      if (foundIndex !== -1) state.data.containers.containers.splice(foundIndex, 1);
    });
  },
});

export const { clearStoragePageStore, setSelectedFile } = storageSlice.actions;

export default storageSlice.reducer;
