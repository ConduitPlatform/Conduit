import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

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
    clearAppNotifications: (state) => {
      state.notifications = [];
    },
    addSnackbar: (state, action) => {
      const key = action.payload.options && action.payload.options.key;
      const notification = {
        ...action.payload,
        key: key || uuidv4(),
      };
      state.notifications = [
        ...state.notifications,
        {
          key: key,
          ...notification,
        },
      ];
    },
    removeSnackbar: (state, action) => {
      state.notifications = state.notifications.filter(
        (notification: { key: number }) => notification.key !== action.payload
      );
    },
  },
});

export const { setAppLoading, setAppDefaults, addSnackbar, removeSnackbar, clearAppNotifications } =
  appSlice.actions;

export default appSlice.reducer;
