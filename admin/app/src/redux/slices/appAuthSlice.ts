import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { removeCookie, setCookie } from '../../utils/cookie';
import { IModule } from '../../models/appAuth';
import { clearEmailPageStore } from '../actions/emailsActions';
import { clearNotificationPageStore } from './notificationsSlice';
import { clearStoragePageStore } from './storageSlice';
import { clearAuthPageStore } from '../actions';
import { getAdminModulesRequest } from '../../http/SettingsRequests';
import { loginRequest } from '../../http/AppAuthRequests';
import { setAppDefaults, setAppError, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';

export type AppAuthState = {
  data: {
    token: any;
    enabledModules: IModule[];
  };
};

//TODO we should probably add types for JWT

const initialState: AppAuthState = {
  data: {
    token: null,
    enabledModules: [],
  },
};

export const asyncLogin = createAsyncThunk(
  'appAuth/login',
  async (values: { username: string; password: string; remember: boolean }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const username = values.username;
      const password = values.password;
      const { data } = await loginRequest(username, password);
      thunkAPI.dispatch(setAppDefaults());
      return { data, cookie: values.remember };
    } catch (error) {
      thunkAPI.dispatch(setAppError(getErrorData(error)));
      thunkAPI.dispatch(setAppLoading(false));
      throw error;
    }
  }
);

export const asyncLogout = createAsyncThunk(
  'appAuth/logout',
  async (arg: void, thunkAPI) => {
    thunkAPI.dispatch(clearAuthPageStore());
    thunkAPI.dispatch(clearEmailPageStore());
    thunkAPI.dispatch(clearNotificationPageStore());
    thunkAPI.dispatch(clearStoragePageStore());
  }
);

export const asyncGetAdminModules = createAsyncThunk(
  'appAuth/getModules',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getAdminModulesRequest();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppError(getErrorData(error)));
      thunkAPI.dispatch(setAppLoading(false));
      throw error;
    }
  }
);

const appAuthSlice = createSlice({
  name: 'appAuth',
  initialState,
  reducers: {
    setToken: (state, action) => {
      state.data.token = action.payload.token;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncLogin.fulfilled, (state, action) => {
      setCookie('JWT', action.payload.data.token, action.payload.cookie);
      state.data.token = action.payload.data.token;
    });
    builder.addCase(asyncGetAdminModules.fulfilled, (state, action) => {
      state.data.enabledModules = action.payload.modules;
    });
    builder.addCase(asyncLogout.fulfilled, (state) => {
      removeCookie('JWT');
      state.data.token = null;
      state.data.enabledModules = [];
    });
  },
});

export const { setToken } = appAuthSlice.actions;

export default appAuthSlice.reducer;
