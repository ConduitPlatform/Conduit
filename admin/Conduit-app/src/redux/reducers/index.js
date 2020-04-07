import {combineReducers} from 'redux';
import authUsersReducer from './authUsersReducer'
import authenticationReducer from "./authenticationReducer";

export default combineReducers({authUsersReducer, authenticationReducer})
