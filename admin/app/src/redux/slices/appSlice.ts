import { createSlice } from '@reduxjs/toolkit';

interface INotification {
  key: number;
  message: string;
  dismissed?: boolean;
  options: {
    autoHideDuration: number;
    key: number;
    variant: string;
  };
}

export type AppState = {
  loading: boolean;
  notifications: INotification[];
};

const initialState: AppState = {
  loading: false,
  notifications: [],
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setAppLoading: (state, action) => {
      state.loading = action.payload;
    },
    setAppDefaults: (state) => {
      state.loading = false;
    },
    enqueueSnackbar: (state, action) => {
      const key = action.payload.options && action.payload.options.key;
      const notification = {
        ...action.payload,
        key: key || new Date().getTime() + Math.random(),
      };
      state.notifications = [
        ...state.notifications,
        {
          key: key,
          ...notification,
        },
      ];
    },
    closeSnackbar: (state, action) => {
      const notificationObj = {
        key: action.payload,
      };
      const dismissedSnackbars = state.notifications.map((notification: { key: number }) =>
        notification.key === notificationObj.key
          ? { ...notification, dismissed: true }
          : { ...notification }
      );
      state.notifications = dismissedSnackbars as INotification[];
    },
    removeSnackbar: (state, action) => {
      state.notifications = state.notifications.filter(
        (notification: { key: number }) => notification.key !== action.payload
      );
    },
  },
});

export const { setAppLoading, setAppDefaults, enqueueSnackbar, closeSnackbar, removeSnackbar } =
  appSlice.actions;

export default appSlice.reducer;
