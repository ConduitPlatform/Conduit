import {
  SET_STORAGE_ERROR,
  SET_STORAGE_CONFIG,
  START_STORAGE_LOADING,
  STOP_STORAGE_LOADING,
  CLEAR_STORAGE_PAGE_STORE,
} from '../actions/actionTypes';

const initialState = {
  data: { config: null },
  loading: false,
  error: null,
};

const storageReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_STORAGE_CONFIG:
      return {
        ...state,
        data: {
          ...state.data,
          config: { ...action.payload },
        },
      };
    case START_STORAGE_LOADING:
      return {
        ...state,
        loading: true,
      };
    case STOP_STORAGE_LOADING:
      return {
        ...state,
        loading: false,
      };
    case SET_STORAGE_ERROR:
      return {
        ...state,
        error: action.payload.error,
      };
    case CLEAR_STORAGE_PAGE_STORE:
      return {
        ...initialState,
      };
    default:
      return state;
  }
};

export default storageReducer;
