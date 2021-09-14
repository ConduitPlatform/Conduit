import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getAdminModulesRequest, loginRequest } from '../../http/requests';
import { removeCookie, setCookie } from '../../utils/cookie';
import { IModule } from '../../models/appAuth';

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
      const { data } = await loginRequest(values.username, values.password);
      return { data, cookie: values.remember };
    } catch (error) {
      throw error;
    }
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
    logout(state) {
      removeCookie('JWT');
      state = initialState;
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
    });
    builder.addCase(asyncGetAdminModules.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetAdminModules.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetAdminModules.fulfilled, (state, action) => {
      console.log(action.payload);
      state.meta.loading = false;
      state.meta.error = null;
      state.data.enabledModules = action.payload.modules;
    });
  },
});

export const { logout } = appAuthSlice.actions;
export default appAuthSlice.reducer;
