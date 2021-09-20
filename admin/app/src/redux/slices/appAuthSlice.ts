import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { removeCookie, setCookie } from '../../utils/cookie';
import { IModule } from '../../models/appAuth';
import { clearEmailPageStore } from '../actions/emailsActions';
import { clearNotificationPageStore } from './notificationsSlice';
import { clearStoragePageStore } from './storageSlice';
import { clearAuthPageStore } from '../actions';
import { getAdminModulesRequest } from '../../http/SettingsRequests';
import { loginRequest } from '../../http/AppAuthRequests';

export type AppAuthState = {
  data: {
    token: any;
    enabledModules: IModule[];
  };
  meta: {
    loading: boolean;
    error: any;
  };
};

//TODO we should probably add types for JWT

const initialState: AppAuthState = {
  data: {
    token: null,
    enabledModules: [],
  },
  meta: {
    loading: false,
    error: null,
  },
};

export const asyncLogin = createAsyncThunk(
  'appAuth/login',
  async (values: { username: string; password: string; remember: boolean }) => {
    try {
      const username = values.username;
      const password = values.password;
      const { data } = await loginRequest(username, password);

      return { data, cookie: values.remember };
    } catch (error) {
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

export const asyncGetAdminModules = createAsyncThunk('appAuth/getModules', async () => {
  try {
    const { data } = await getAdminModulesRequest();
    return data;
  } catch (error) {
    throw error;
  }
});

const appAuthSlice = createSlice({
  name: 'appAuth',
  initialState,
  reducers: {
    setToken: (state, action) => {
      state.data.token = action.payload.token;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncLogin.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncLogin.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncLogin.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      setCookie('JWT', action.payload.data.token, action.payload.cookie);
      state.data.token = action.payload.data.token;
    });
    builder.addCase(asyncGetAdminModules.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetAdminModules.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetAdminModules.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.enabledModules = action.payload.modules;
    });
    builder.addCase(asyncLogout.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncLogout.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncLogout.fulfilled, (state) => {
      removeCookie('JWT');
      state.data.token = null;
      state.data.enabledModules = [];
      state.meta.loading = false;
      state.meta.error = null;
    });
  },
});

export const { setToken } = appAuthSlice.actions;

export default appAuthSlice.reducer;
