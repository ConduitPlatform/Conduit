import { combineReducers } from 'redux';
import appAuthSlice from '../slices/appAuthSlice';
import authenticationSlice from '../slices/authenticationSlice';
import emailsPageReducer from './emailsPageReducer';
import settingsSlice from '../slices/settingsSlice';
import cmsReducer from './cmsReducer';
import storageSlice from '../slices/storageSlice';
import notificationsSlice from '../slices/notificationsSlice';
import customEndpointsReducer from './customEndpointsReducer';

export default combineReducers({});
