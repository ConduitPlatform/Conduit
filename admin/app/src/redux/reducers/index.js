import { combineReducers } from 'redux';
import appAuthReducer from './appAuthReducer';
import authenticationSlice from '../slices/authenticationSlice';
import emailsPageReducer from './emailsPageReducer';
import settingsSlice from '../slices/settingsSlice';
import cmsReducer from './cmsReducer';
import storageSlice from '../slices/storageSlice';
import notificationsSlice from '../slices/notificationsSlice';
import customEndpointsReducer from './customEndpointsReducer';

export default combineReducers({
  authenticationSlice,
  appAuthReducer,
  emailsPageReducer,
  notificationsSlice,
  storageSlice,
  cmsReducer,
  settingsSlice,
  customEndpointsReducer,
});
