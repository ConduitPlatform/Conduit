import { combineReducers } from 'redux';
import appAuthReducer from './appAuthReducer';
import authenticationPageReducer from './authenticationPageReducer';
import notificationReducer from './notificationReducer';
import storageReducer from './storageReducer';
import cmsReducer from './cmsReducer';
import settingsReducer from './settingsReducer';
import customEndpointsReducer from './customEndpointsReducer';
import emailsSlice from '../slices/emailsSlice';

export default combineReducers({
  authenticationPageReducer,
  appAuthReducer,
  emailsSlice,
  notificationReducer,
  storageReducer,
  cmsReducer,
  settingsReducer,
  customEndpointsReducer,
});
