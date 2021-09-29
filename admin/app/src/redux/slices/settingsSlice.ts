import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  IClient,
  INewAdminUser,
  IPlatformTypes,
} from '../../models/settings/SettingsModels';
import {
  getAvailableClientsRequest,
  generateNewClientRequest,
  deleteClientRequest,
  putCoreRequest,
  postNewAdminUser,
} from '../../http/SettingsRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { notify } from 'reapop';

interface INotificationSlice {
  data: {
    availableClients: IClient[];
  };
}

const initialState: INotificationSlice = {
  data: { availableClients: [] },
};

export const asyncGetAvailableClients = createAsyncThunk(
  'notifications/getClients',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getAvailableClientsRequest();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(
        notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 })
      );
      throw error;
    }
  }
);

export const asyncGenerateNewClient = createAsyncThunk(
  'settings/generateClient',
  async (platform: IPlatformTypes, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await generateNewClientRequest(platform);
      thunkAPI.dispatch(setAppDefaults());

      return data;
    } catch (error) {
      thunkAPI.dispatch(
        notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 })
      );
      throw error;
    }
  }
);

export const asyncDeleteClient = createAsyncThunk(
  'settings/deleteClient',
  async (_id: string, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteClientRequest(_id);
      thunkAPI.dispatch(setAppDefaults());
      return _id;
    } catch (error) {
      thunkAPI.dispatch(
        notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 })
      );
      throw error;
    }
  }
);

export const asyncPutCoreSettings = createAsyncThunk(
  'settings/saveConfig',
  async (data, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      thunkAPI.dispatch(setAppDefaults());
      return await putCoreRequest(data);
    } catch (error) {
      thunkAPI.dispatch(
        notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 })
      );
      throw error;
    }
  }
);

export const asyncCreateAdminUser = createAsyncThunk(
  'settings/createAdminUser',
  async (values: INewAdminUser, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const body = {
        username: values.username,
        password: values.password,
      };
      thunkAPI.dispatch(
        notify(`Successfully created user ${body.username}!`, 'success', {
          dismissAfter: 3000,
        })
      );
      thunkAPI.dispatch(setAppDefaults());
      const { data } = await postNewAdminUser(body); //fix this
    } catch (error) {
      thunkAPI.dispatch(
        notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 })
      );
      throw error;
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(asyncGetAvailableClients.fulfilled, (state, action) => {
      state.data.availableClients = action.payload;
    });
    builder.addCase(asyncGenerateNewClient.fulfilled, (state, action) => {
      state.data.availableClients.push(action.payload);
    });
    builder.addCase(asyncDeleteClient.fulfilled, (state, action) => {
      const allClients = state.data.availableClients;
      const clientIndex = allClients.findIndex((c) => c._id === action.payload);
      if (clientIndex !== -1) {
        allClients.splice(clientIndex, 1);
      }
    });
  },
});

export default settingsSlice.reducer;
