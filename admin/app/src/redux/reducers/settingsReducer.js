import {
  APPEND_NEW_CLIENT,
  DELETE_CLIENT,
  SET_AVAILABLE_CLIENTS,
  SET_SETTINGS_ERROR,
  START_SETTINGS_LOADING,
  STOP_SETTINGS_LOADING,
} from '../actions/actionTypes';

const initialState = {
  data: { availableClients: [] },
  loading: false,
  error: null,
};

const settingsReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_AVAILABLE_CLIENTS: {
      return {
        ...state,
        data: { availableClients: action.payload },
      };
    }
    case APPEND_NEW_CLIENT: {
      return {
        ...state,
        data: { availableClients: [...state.data.availableClients, action.payload] },
      };
    }
    case DELETE_CLIENT: {
      const allClients = state.data.availableClients.slice();
      const clientIndex = allClients.findIndex((c) => c._id === action.payload);
      if (clientIndex !== -1) {
        allClients.splice(clientIndex, 1);
        return {
          ...state,
          data: { availableClients: [...allClients] },
        };
      }
      return state;
    }
    case START_SETTINGS_LOADING: {
      return { ...state, loading: true };
    }
    case STOP_SETTINGS_LOADING: {
      return { ...state, loading: false };
    }
    case SET_SETTINGS_ERROR: {
      return { ...state, error: action.payload };
    }
    default:
      return state;
  }
};

export default settingsReducer;
