import {
  ADD_AUTH_USERS,
  CLEAR_AUTH_PAGE_STORE,
  SET_AUTH_USERS_ERROR,
  SET_AUTHENTICATION_CONFIG,
  SET_AUTHENTICATION_CONFIG_ERROR,
  START_AUTH_USERS_LOADING,
  START_AUTHENTICATION_CONFIG_LOADING,
  STOP_AUTH_USERS_LOADING,
  STOP_AUTHENTICATION_CONFIG_LOADING,
} from '../actions/actionTypes';

const initialState = {
  authUsersState: { users: null, count: 0, loading: false, error: null },
  signInMethodsState: { data: null, loading: false, error: null },
};

const authenticationPageReducer = (state = initialState, action) => {
  switch (action.type) {
    case ADD_AUTH_USERS:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: action.payload.users,
          count: action.payload.count,
        },
      };
    case START_AUTH_USERS_LOADING:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          loading: true,
        },
      };
    case STOP_AUTH_USERS_LOADING:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          loading: false,
        },
      };
    case SET_AUTH_USERS_ERROR:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          error: action.payload.error,
        },
      };
    case SET_AUTHENTICATION_CONFIG:
      return {
        ...state,
        signInMethodsState: {
          ...state.signInMethodsState,
          data: action.payload,
        },
      };
    case START_AUTHENTICATION_CONFIG_LOADING:
      return {
        ...state,
        signInMethodsState: {
          ...state.signInMethodsState,
          loading: true,
        },
      };
    case STOP_AUTHENTICATION_CONFIG_LOADING:
      return {
        ...state,
        signInMethodsState: {
          ...state.signInMethodsState,
          loading: false,
        },
      };
    case SET_AUTHENTICATION_CONFIG_ERROR:
      return {
        ...state,
        signInMethodsState: {
          ...state.signInMethodsState,
          error: action.payload.error,
        },
      };
    case CLEAR_AUTH_PAGE_STORE:
      return {
        ...initialState,
      };
    default:
      return state;
  }
};

export default authenticationPageReducer;
