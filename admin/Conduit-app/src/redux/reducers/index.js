import { combineReducers } from 'redux';
import appAuthReducer from './appAuthReducer';
import authenticationPageReducer from './authenticationPageReducer';
import emailsPageReducer from './emailsPageReducer';
import notificationReducer from './notificationReducer';

export default combineReducers({
  authenticationPageReducer,
  appAuthReducer,
  emailsPageReducer,
  notificationReducer,
});
