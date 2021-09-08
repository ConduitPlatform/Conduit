import { combineReducers } from 'redux';
import appAuthReducer from './appAuthReducer';
import authenticationPageReducer from './authenticationPageReducer';
import emailsPageReducer from './emailsPageReducer';
import notificationReducer from './notificationReducer';
import storageReducer from './storageReducer';
import cmsReducer from './cmsReducer';
import settingsReducer from './settingsReducer';
import customEndpointsReducer from './customEndpointsReducer';

export default combineReducers({
  authenticationPageReducer,
  appAuthReducer,
  emailsPageReducer,
  notificationReducer,
  storageReducer,
  cmsReducer,
  settingsReducer,
  customEndpointsReducer,
});
