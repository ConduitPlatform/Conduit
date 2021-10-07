import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { AuthUser } from '../../models/authentication/AuthModels';
import { SignInMethods } from '../../models/authentication/AuthModels';
import {
  getAuthUsersDataReq,
  createNewUsers,
  editUser,
  blockUser,
  unblockUser,
  deleteUser,
  getAuthenticationConfig,
  putAuthenticationConfig,
  blockUnblockUsers,
  deleteUsers,
} from '../../http/AuthenticationRequests';
import { setAppDefaults, setAppLoading } from './appSlice';
import { getErrorData } from '../../utils/error-handler';
import { notify } from 'reapop';

interface IAuthenticationSlice {
  data: {
    authUsers: {
      users: AuthUser[];
      count: number;
    };
    signInMethods: SignInMethods | null;
  };
}

const initialState: IAuthenticationSlice = {
  data: {
    authUsers: {
      users: [],
      count: 0,
    },
    signInMethods: null,
  },
};

export const asyncGetAuthUserData = createAsyncThunk(
  'authentication/getUserData',
  async (params: { skip: number; limit: number; search: string; filter: string }, thunkAPI) => {
    try {
      const { data } = await getAuthUsersDataReq(
        params.skip,
        params.limit,
        params.search,
        params.filter
      );
      console.log('data', data);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncAddNewUser = createAsyncThunk(
  'authentication/addUser',
  async (params: { values: { password: string; email: string }; limit: number }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await createNewUsers(params.values);
      thunkAPI.dispatch(
        asyncGetAuthUserData({ skip: 0, limit: params.limit, search: '', filter: 'none' })
      );
      thunkAPI.dispatch(
        notify(`Successfully added ${params.values.email}!`, 'success', {
          dismissAfter: 3000,
        })
      );
      thunkAPI.dispatch(setAppDefaults());
      return { data, params };
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncEditUser = createAsyncThunk(
  'authentication/editUser',
  async (values: AuthUser, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await editUser(values);
      thunkAPI.dispatch(
        notify(`Successfully edited user ${values.email}!`, 'success', {
          dismissAfter: 3000,
        })
      );
      thunkAPI.dispatch(setAppDefaults());
      return values;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncBlockUserUI = createAsyncThunk(
  'authentication/blockUser',
  async (id: string, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await blockUser(id);
      thunkAPI.dispatch(setAppDefaults());
      return id;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncBlockUnblockUsers = createAsyncThunk(
  'authentication/blockUnblockUsers',
  async (params: { body: { ids: string[]; block: boolean }; getUsers: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await blockUnblockUsers(params.body);
      thunkAPI.dispatch(setAppDefaults());
      params.getUsers();
      return params.body.ids;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncUnblockUserUI = createAsyncThunk(
  'authentication/unblockUser',
  async (id: string, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await unblockUser(id);
      thunkAPI.dispatch(setAppDefaults());
      return id;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncDeleteUser = createAsyncThunk(
  'authentication/deleteUser',
  async (id: string, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteUser(id);
      thunkAPI.dispatch(
        notify(`Successfully deleted user!`, 'warning', {
          dismissAfter: 3000,
        })
      );
      thunkAPI.dispatch(setAppDefaults());
      return id;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncDeleteUsers = createAsyncThunk(
  'authentication/deleteUsers',
  async (params: { ids: string[]; getUsers: any }, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      await deleteUsers(params.ids);
      params.getUsers();
      thunkAPI.dispatch(
        notify(`Successfully deleted users!`, 'warning', {
          dismissAfter: 3000,
        })
      );
      thunkAPI.dispatch(setAppDefaults());
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncGetAuthenticationConfig = createAsyncThunk(
  'authentication/getConfig',
  async (arg, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await getAuthenticationConfig();
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

export const asyncUpdateAuthenticationConfig = createAsyncThunk(
  'authentication/updateConfig',
  async (body: any, thunkAPI) => {
    thunkAPI.dispatch(setAppLoading(true));
    try {
      const { data } = await putAuthenticationConfig(body);
      thunkAPI.dispatch(setAppDefaults());
      return data;
    } catch (error) {
      thunkAPI.dispatch(setAppLoading(false));
      thunkAPI.dispatch(notify(`${getErrorData(error)}`, 'error', { dismissAfter: 3000 }));
      throw error;
    }
  }
);

const authenticationSlice = createSlice({
  name: 'authentication',
  initialState,
  reducers: {
    clearAuthenticationPageStore: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetAuthUserData.fulfilled, (state, action) => {
      state.data.authUsers.users = action.payload.users;
      state.data.authUsers.count = action.payload.count;
    });
    builder.addCase(asyncAddNewUser.fulfilled, (state) => {
      state.data.authUsers.count++;
    });
    builder.addCase(asyncEditUser.fulfilled, (state, action) => {
      const foundIndex = state.data.authUsers.users.findIndex(
        (user) => user._id === action.payload._id
      );
      if (foundIndex !== -1) state.data.authUsers.users.splice(foundIndex, 1, action.payload);
    });
    builder.addCase(asyncBlockUserUI.fulfilled, (state, action) => {
      const userToBlock = state.data.authUsers.users.find((user) => user._id === action.payload);
      if (userToBlock) {
        userToBlock.active = false;
      }
    });
    builder.addCase(asyncUnblockUserUI.fulfilled, (state, action) => {
      const userToUnBlock = state.data.authUsers.users.find((user) => user._id === action.payload);
      if (userToUnBlock) {
        userToUnBlock.active = true;
      }
    });
    builder.addCase(asyncDeleteUser.fulfilled, (state, action) => {
      const foundIndex = state.data.authUsers.users.findIndex(
        (user) => user._id === action.payload
      );
      if (foundIndex !== -1) state.data.authUsers.users.splice(foundIndex, 1);
      state.data.authUsers.count--;
    });
    builder.addCase(asyncGetAuthenticationConfig.fulfilled, (state, action) => {
      state.data.signInMethods = action.payload;
    });
    builder.addCase(asyncUpdateAuthenticationConfig.fulfilled, (state, action) => {
      state.data.signInMethods = action.payload;
    });
  },
});

export const { clearAuthenticationPageStore } = authenticationSlice.actions;

export default authenticationSlice.reducer;
