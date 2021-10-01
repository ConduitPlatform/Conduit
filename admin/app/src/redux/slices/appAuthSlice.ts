import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { removeCookie, setCookie } from '../../utils/cookie';
import { IModule } from '../../models/appAuth';
import { clearNotificationPageStore } from './notificationsSlice';
import { clearStoragePageStore } from './storageSlice';
import { getAdminModulesRequest } from '../../http/SettingsRequests';
import { loginRequest } from '../../http/AppAuthRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { clearEmailPageStore } from './emailsSlice';
import { clearAuthenticationPageStore } from './authenticationSlice';
import { notify } from 'reapop';

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
      thunkAPI.dispatch(
        notify(`Welcome ${username}!`, 'success', {
          dismissAfter: 3000,
        })
      );
      thunkAPI.dispatch(setAppDefaults());
      return { data, cookie: values.remember };
    } catch (error) {
      thunkAPI.dispatch(
        notify(`Could not login! error msg:${getErrorData(error)}`, 'error', {
          dismissAfter: 3000,
        })
      );
      throw error;
    }
  }
);

export const asyncLogout = createAsyncThunk(
  'appAuth/logout',
  async (arg: void, thunkAPI) => {
    thunkAPI.dispatch(clearAuthenticationPageStore());
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
      thunkAPI.dispatch(
        notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 })
      );
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
