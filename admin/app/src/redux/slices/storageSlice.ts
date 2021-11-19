import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  ContainerDataProps,
  IContainer,
  IStorageConfig,
  IStorageFile,
  IStorageFileData,
  IStorageFolderData,
} from '../../models/storage/StorageModels';
import {
  createStorageContainer,
  createStorageFile,
  createStorageFolder,
  deleteStorageContainer,
  deleteStorageFile,
  deleteStorageFolder,
  getStorageContainers,
  getStorageFiles,
  getStorageFileUrl,
  getStorageFolders,
  getStorageSettings,
  putStorageSettings,
} from '../../http/StorageRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { enqueueErrorNotification, enqueueSuccessNotification } from '../../utils/useNotifier';
import { concat } from 'lodash';
import {
  ICreateStorageContainer,
  ICreateStorageFolder,
} from '../../models/storage/StorageRequestsModels';

interface IStorageSlice {
  data: {
    config: IStorageConfig;
    containers: {
      containers: IContainer[];
      containersCount: number;
      areContainersEmpty: boolean;
    };
    containerData: {
      data: ContainerDataProps[];
      totalCount: number;
      areContainerDataEmpty: boolean;
    };
    selectedFileUrl: string;
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
      areContainersEmpty: false,
    },
    containerData: {
      totalCount: 0,
      data: [],
      areContainerDataEmpty: false,
    },
    selectedFileUrl: '',
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
      const newFileData = fileData.files.map((file: IStorageFileData) => {
        return Object.assign(file, { isFile: true });
      });

      const totalCount = folderData.folderCount + fileData.filesCount;

      thunkAPI.dispatch(setAppDefaults());
      if (fileLimit < 1) {
        return { data: folderData.folders, totalCount: totalCount };
      }
      return { data: concat(folderData.folders, newFileData), totalCount: totalCount };
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncAddStorageFile = createAsyncThunk(
  'storage/addStorageFile',
  async (params: { fileData: IStorageFile; getContainerData: () => void }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createStorageFile(params.fileData);
      params.getContainerData();
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
  async (
    params: {
      folderData: ICreateStorageFolder;
      getContainerData: () => void;
    },
    thunkAPI
  ) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createStorageFolder(params.folderData);
      params.getContainerData();
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
  async (
    params: { containerData: ICreateStorageContainer; getContainers: () => void },
    thunkAPI
  ) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createStorageContainer(params.containerData);
      params.getContainers();
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

export const asyncDeleteStorageFile = createAsyncThunk(
  'storage/deleteStorageFile',
  async (params: { id: string; getContainerData: () => void }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteStorageFile(params.id);
      params.getContainerData();
      thunkAPI.dispatch(setAppDefaults());
      thunkAPI.dispatch(enqueueSuccessNotification('Successfully deleted file!'));
      return params.id;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
      throw error;
    }
  }
);

export const asyncDeleteStorageFolder = createAsyncThunk(
  'storage/deleteStorageFolder',
  async (
    params: { id: string; name: string; container: string; getContainerData: () => void },
    thunkAPI
  ) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteStorageFolder(params);
      params.getContainerData();
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
  async (params: { id: string; name: string; getContainers: () => void }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteStorageContainer(params);
      params.getContainers();
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

// to be implemented in the future

// export const asyncUpdateStorageFile = createAsyncThunk(
//   'storage/updateStorageFile',
//   async (arg, thunkAPI) => {
//     thunkAPI.dispatch(setAppLoading(true));
//     try {
//       const fileData = {
//         id: '617158368afe4116b6882eb0',
//         name: 'new-example-file',
//         folder: 'test-folder',
//         container: 'conduit',
//         data: base64example,
//       };
//       const { data } = await updateStorageFile(fileData);
//       thunkAPI.dispatch(enqueueSuccessNotification('Successfully updated file!'));
//       thunkAPI.dispatch(setAppDefaults());
//       return data;
//     } catch (error) {
//       thunkAPI.dispatch(setAppLoading(false));
//       thunkAPI.dispatch(enqueueErrorNotification(`${getErrorData(error)}`));
//       throw error;
//     }
//   }
// );

export const asyncSetSelectedStorageFile = createAsyncThunk(
  'storage/setSelectedStorageFile',
  async (file: any, thunkAPI) => {
    // thunkAPI.dispatch(setAppLoading(true));
    try {
      let url;
      if (!file.url) {
        const { data } = await getStorageFileUrl(file._id, false);
        url = data;
      } else {
        url = file.url;
      }
      thunkAPI.dispatch(setAppDefaults());
      return url;
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
    clearStorageContainerData: (state) => {
      state.data.containerData.data = [];
    },
    setContainerDataEmpty: (state, action) => {
      state.data.containerData.areContainerDataEmpty = action.payload;
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
      state.data.containers.containers = action.payload.containers;
      state.data.containers.containersCount = action.payload.containersCount;
      if (action.payload.containersCount < 1) {
        state.data.containers.areContainersEmpty = true;
        return;
      }
      state.data.containers.areContainersEmpty = false;
    });
    builder.addCase(asyncGetStorageContainerData.fulfilled, (state, action) => {
      state.data.containerData.data = action.payload.data;
      state.data.containerData.totalCount = action.payload.totalCount;
      if (action.payload.totalCount < 1) {
        state.data.containerData.areContainerDataEmpty = true;
      }
    });
    builder.addCase(asyncDeleteStorageFile.fulfilled, (state, action) => {
      const foundIndex = state.data.containerData.data.findIndex(
        (item) => item._id === action.payload
      );
      if (foundIndex !== -1) state.data.containerData.data.splice(foundIndex, 1);
    });
    builder.addCase(asyncDeleteStorageFolder.fulfilled, (state, action) => {
      const foundIndex = state.data.containerData.data.findIndex(
        (item: IStorageFolderData) => item._id === action.payload
      );
      if (foundIndex !== -1) state.data.containerData.data.splice(foundIndex, 1);
    });
    builder.addCase(asyncDeleteStorageContainer.fulfilled, (state, action) => {
      const foundIndex = state.data.containers.containers.findIndex(
        (item) => item._id === action.payload
      );
      if (foundIndex !== -1) state.data.containers.containers.splice(foundIndex, 1);
    });
    builder.addCase(asyncSetSelectedStorageFile.fulfilled, (state, action) => {
      state.data.selectedFileUrl = action.payload;
    });
  },
});

export const { clearStoragePageStore, clearStorageContainerData, setContainerDataEmpty } =
  storageSlice.actions;

export default storageSlice.reducer;
