import {
  CLEAR_NOTIFICATION_PAGE_STORE,
  SET_NOTIFICATION_CONFIG,
  SET_NOTIFICATION_ERROR,
  START_NOTIFICATION_LOADING,
  STOP_NOTIFICATION_LOADING,
} from '../actions/actionTypes';

const initialState = {
  data: { config: null, notifications: null },
  loading: false,
  error: null,
};

const notificationReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_NOTIFICATION_CONFIG:
      return {
        ...state,
        data: {
          ...state.data,
          config: { ...action.payload },
        },
      };
    case START_NOTIFICATION_LOADING:
      return {
        ...state,
        loading: true,
      };
    case STOP_NOTIFICATION_LOADING:
      return {
        ...state,
        loading: false,
      };
    case SET_NOTIFICATION_ERROR:
      return {
        ...state,
        error: action.payload.error,
      };
    case CLEAR_NOTIFICATION_PAGE_STORE:
      return {
        ...initialState,
      };
    default:
      return state;
  }
};

export default notificationReducer;
