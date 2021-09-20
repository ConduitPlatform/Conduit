import { combineReducers } from 'redux';
import appAuthReducer from './appAuthReducer';
import authenticationPageReducer from './authenticationPageReducer';
import emailsPageReducer from './emailsPageReducer';
import notificationReducer from './notificationReducer';
import settingsSlice from '../slices/settingsSlice';
import cmsSlice from '../slices/cmsSlice';
import storageSlice from '../slices/storageSlice';
import notificationsSlice from '../slices/notificationsSlice';
import customEndpointsSlice from '../slices/customEndpointsSlice';

export default combineReducers({
  authenticationPageReducer,
  appAuthReducer,
  emailsPageReducer,
  notificationsSlice,
  storageSlice,
  cmsSlice,
  settingsSlice,
  customEndpointsSlice,
});
