import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getAdminModulesRequest, loginRequest } from '../../http/requests';
import { setCookie } from '../../utils/cookie';

export type AppAuthState = {
  data: {
    token: any;
    enabledModules: any;
  };
  meta: {
    loading: boolean;
    error: any;
  };
};

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
  async (params: { username: string; password: string; remember: boolean }) => {
    try {
      const { data } = await loginRequest(params.username, params.password);
      return { data, cookie: params.remember };
    } catch (error) {
      throw error;
    }
  }
);

export const asyncLogout = createAsyncThunk('appAuth/logout', async () => {
  try {
    //TODO clearing the state here once we have all the slices done
  } catch (error) {
    throw error;
  }
});

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
  reducers: {},
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
      setCookie('JWT', action.payload.data, action.payload.cookie);
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
  },
});

export default appAuthSlice.reducer;
