import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';
import authenticationSlice from './slices/authenticationSlice';
import appAuthSlice from './slices/appAuthSlice';
import notificationsSlice from './slices/notificationsSlice';
import storageSlice from './slices/storageSlice';
import settingsSlice from './slices/settingsSlice';
import emailsSlice from './slices/emailsSlice';
import cmsSlice from './slices/cmsSlice';
import customEndpointsSlice from './slices/customEndpointsSlice';
import { useMemo } from 'react';
import { useDispatch } from 'react-redux';

let store: any;

export const makeStore = (preloadedState: any) =>
  configureStore({
    reducer: {
      authenticationSlice,
      appAuthSlice,
      cmsSlice,
      customEndpointsSlice,
      notificationsSlice,
      storageSlice,
      settingsSlice,
      emailsSlice,
    },
    preloadedState,
  });

export const initializeStore = (preloadedState: any) => {
  let _store = store ?? makeStore(preloadedState);

  if (preloadedState && store) {
    _store = makeStore({ ...store.getState(), ...preloadedState });
    store = undefined;
  }

  // For SSG and SSR always create a new store
  if (typeof window === 'undefined') return _store;
  // Create the store once in the client
  if (!store) store = _store;

  return _store;
};

export const getCurrentStore = () => {
  return store;
};

export const useStore = (initialState: any) => {
  return useMemo(() => initializeStore(initialState), [initialState]);
};

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export type AppThunk = ThunkAction<void, RootState, unknown, Action<string>>;

export default store;
