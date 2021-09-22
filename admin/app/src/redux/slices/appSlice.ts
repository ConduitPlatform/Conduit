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
    setAppError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setAppLoading, setAppError } = appSlice.actions;

export default appSlice.reducer;
