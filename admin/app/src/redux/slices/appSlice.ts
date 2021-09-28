import { createSlice } from '@reduxjs/toolkit';

export type AppState = {
  loading: boolean;
  error: {
    message: string;
    status: number | null;
    statusText: string;
  };
};

const initialState: AppState = {
  loading: false,
  error: {
    message: '',
    status: null,
    statusText: '',
  },
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAppLoading: (state, action) => {
      state.loading = action.payload;
    },

    setAppDefaults: () => {
      return initialState;
    },
  },
});

export const { setAppLoading, setAppDefaults } = appSlice.actions;

export default appSlice.reducer;
