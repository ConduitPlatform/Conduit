import { createAsyncThunk, createSlice, current } from '@reduxjs/toolkit';
import { AuthUser } from '../../models/authentication/AuthModels';
import {
  blockUser,
  createNewUsers,
  deleteUser,
  editUser,
  getAuthenticationConfig,
  getAuthUsersDataReq,
  putAuthenticationConfig,
  unblockUser,
} from '../../http/requests';
import { SignInMethods } from '../../models/authentication/AuthModels';
import { getAuthUsersData } from '../thunks/authenticationThunks';

interface IAuthenticationSlice {
  data: {
    authUsers: {
      users: AuthUser[];
      count: number;
    };
    signInMethods: SignInMethods | null;
  };
  meta: {
    authUsers: { loading: boolean; error: Error | null; success: string | null };
    signInMethods: { loading: boolean; error: Error | null };
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
  meta: {
    authUsers: { loading: false, error: null, success: '' },
    signInMethods: { loading: false, error: null },
  },
};

export const asyncGetAuthUserData = createAsyncThunk(
  'authentication/getUserData',
  async (params: { skip: number; limit: number; search: string; filter: string }) => {
    try {
      const { data } = await getAuthUsersDataReq(
        params.skip,
        params.limit,
        params.search,
        params.filter
      );
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncAddNewUser = createAsyncThunk(
  'authentication/addUser',
  async (
    params: { values: { password: string; email: string }; limit: number },
    thunkApi
  ) => {
    try {
      const filter = { filterValue: 'none' };
      const { data } = await createNewUsers(params.values);
      thunkApi.dispatch(getAuthUsersData(0, params.limit, '', filter));
      setTimeout(() => {
        thunkApi.dispatch(clearSuccesMsg());
      }, 6300);
      return { data, params };
    } catch (error) {
      throw error;
    }
  }
);

export const asyncEditUser = createAsyncThunk(
  'authentication/editUser',
  async (values: AuthUser) => {
    try {
      await editUser(values);
      return values;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncBlockUserUI = createAsyncThunk(
  'authentication/blockUser',
  async (id: string) => {
    try {
      await blockUser(id);
      return id;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncUnblockUserUI = createAsyncThunk(
  'authentication/unblockUser',
  async (id: string) => {
    try {
      await unblockUser(id);
      return id;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncDeleteUser = createAsyncThunk(
  'authentication/deleteUser',
  async (id: string) => {
    try {
      await deleteUser(id);
      return id;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetAuthenticationConfig = createAsyncThunk(
  'authentication/getConfig',
  async () => {
    try {
      const { data } = await getAuthenticationConfig();
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncUpdateAuthenticationConfig = createAsyncThunk(
  'authentication/updateConfig',
  async (body: any) => {
    try {
      const { data } = await putAuthenticationConfig(body);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

const authenticationSlice = createSlice({
  name: 'authentication',
  initialState,
  reducers: {
    clearSuccesMsg(state) {
      state.meta.authUsers.success = null;
    },
    clearAuthenticationPageStore(state) {
      state = initialState;
    },
    setLoading(state, action) {
      state.meta.authUsers.loading = action.payload;
    },
    setError(state, action) {
      state.meta.authUsers.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asyncGetAuthUserData.pending, (state) => {
      state.meta.authUsers.loading = true;
    });
    builder.addCase(asyncGetAuthUserData.rejected, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = action.error as Error;
    });
    builder.addCase(asyncGetAuthUserData.fulfilled, (state, action) => {
      state.meta.authUsers.loading = false;
      state.data.authUsers.users = action.payload.users;
      state.data.authUsers.count = action.payload.count;
    });
    builder.addCase(asyncAddNewUser.pending, (state) => {
      state.meta.authUsers.loading = true;
    });
    builder.addCase(asyncAddNewUser.rejected, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = action.error as Error;
    });
    builder.addCase(asyncAddNewUser.fulfilled, (state, action) => {
      state.meta.authUsers.success = action.payload.data.message;
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = null;
      state.data.authUsers.count++;
    });
    builder.addCase(asyncEditUser.pending, (state) => {
      state.meta.authUsers.loading = true;
    });
    builder.addCase(asyncEditUser.rejected, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = action.error as Error;
    });
    builder.addCase(asyncEditUser.fulfilled, (state, action) => {
      state.meta.authUsers.loading = false;
      const foundIndex = state.data.authUsers.users.findIndex(
        (user) => user._id === action.payload._id
      );
      if (foundIndex !== -1)
        state.data.authUsers.users.splice(foundIndex, 1, action.payload);
    });
    builder.addCase(asyncBlockUserUI.pending, (state) => {
      state.meta.authUsers.loading = true;
    });
    builder.addCase(asyncBlockUserUI.rejected, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = action.error as Error;
    });
    builder.addCase(asyncBlockUserUI.fulfilled, (state, action) => {
      state.meta.authUsers.loading = false;
      let userToBlock = state.data.authUsers.users.find(
        (user) => user._id === action.payload
      );
      if (userToBlock) {
        userToBlock.active = false;
      }
    });
    builder.addCase(asyncUnblockUserUI.pending, (state) => {
      state.meta.authUsers.loading = true;
    });
    builder.addCase(asyncUnblockUserUI.rejected, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = action.error as Error;
    });
    builder.addCase(asyncUnblockUserUI.fulfilled, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = null;
      let userToUnBlock = state.data.authUsers.users.find(
        (user) => user._id === action.payload
      );
      if (userToUnBlock) {
        userToUnBlock.active = true;
      }
    });
    builder.addCase(asyncDeleteUser.pending, (state) => {
      state.meta.authUsers.loading = true;
    });
    builder.addCase(asyncDeleteUser.rejected, (state, action) => {
      state.meta.authUsers.loading = false;
      state.meta.authUsers.error = action.error as Error;
    });
    builder.addCase(asyncDeleteUser.fulfilled, (state, action) => {
      state.meta.authUsers.loading = false;
      const foundIndex = state.data.authUsers.users.findIndex(
        (user) => user._id === action.payload
      );
      if (foundIndex !== -1) state.data.authUsers.users.splice(foundIndex, 1);
      state.data.authUsers.count--;
    });
    builder.addCase(asyncGetAuthenticationConfig.pending, (state) => {
      state.meta.signInMethods.loading = true;
    });
    builder.addCase(asyncGetAuthenticationConfig.rejected, (state, action) => {
      state.meta.signInMethods.loading = false;
      state.meta.signInMethods.error = action.error as Error;
    });
    builder.addCase(asyncGetAuthenticationConfig.fulfilled, (state, action) => {
      state.meta.signInMethods.loading = false;
      state.meta.signInMethods.error = null;
      state.data.signInMethods = action.payload;
      console.log(state.data.signInMethods);
    });
    builder.addCase(asyncUpdateAuthenticationConfig.pending, (state) => {
      state.meta.signInMethods.loading = true;
    });
    builder.addCase(asyncUpdateAuthenticationConfig.rejected, (state, action) => {
      state.meta.signInMethods.loading = false;
      state.meta.signInMethods.error = action.error as Error;
    });
    builder.addCase(asyncUpdateAuthenticationConfig.fulfilled, (state, action) => {
      state.meta.signInMethods.loading = false;
      state.data.signInMethods = action.payload;
    });
  },
});

export const {
  clearAuthenticationPageStore,
  setLoading,
  clearSuccesMsg,
} = authenticationSlice.actions;

export default authenticationSlice.reducer;
