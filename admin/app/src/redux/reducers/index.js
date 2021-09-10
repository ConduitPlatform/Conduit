import { combineReducers } from 'redux';
import appAuthReducer from './appAuthReducer';
import authenticationPageReducer from './authenticationPageReducer';
import emailsPageReducer from './emailsPageReducer';
import notificationReducer from './notificationReducer';
import settingsSlice from '../slices/settingsSlice';
import cmsReducer from './cmsReducer';
import storageSlice from '../slices/storageSlice';
import notificationsSlice from '../slices/notificationsSlice';
import customEndpointsReducer from './customEndpointsReducer';

export default combineReducers({
  authenticationPageReducer,
  appAuthReducer,
  emailsPageReducer,
  notificationsSlice,
  storageSlice,
  cmsReducer,
  settingsSlice,
  customEndpointsReducer,
});
