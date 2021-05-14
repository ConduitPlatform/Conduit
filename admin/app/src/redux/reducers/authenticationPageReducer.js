import {
  ADD_NEW_USER,
  ADD_AUTH_USERS,
  SEARCH_USERS,
  EDIT_USER_ACTION,
  DELETE_USER_ACTION,
  BLOCK_USER_UI,
  UNBLOCK_USER_UI,
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
    case SEARCH_USERS:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: action.payload.users,
          count: action.payload.count,
        },
      };
    case ADD_NEW_USER:
      console.log(action.payload);
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: [...state.users, action.payload],
        },
      };
    case EDIT_USER_ACTION:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: [
            ...state.authUsersState.users.map((user) =>
              user._id !== action.payload._id ? user : action.payload
            ),
          ],
        },
      };

    case BLOCK_USER_UI:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: [
            ...state.authUsersState.users.map((user) =>
              user._id !== action.payload ? user : { ...user, active: false }
            ),
          ],
        },
      };

    case UNBLOCK_USER_UI:
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: [
            ...state.authUsersState.users.map((user) =>
              user._id !== action.payload ? user : { ...user, active: true }
            ),
          ],
        },
      };

    case DELETE_USER_ACTION:
      console.log(action.payload);
      return {
        ...state,
        authUsersState: {
          ...state.authUsersState,
          users: [
            ...state.authUsersState.users.filter((user) =>
              user._id === action.payload ? user : ''
            ),
          ],
          count: state.authUsersState.count - 1,
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
