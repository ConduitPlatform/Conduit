import {
  ENDPOINT_CLEAN_SLATE,
  SET_ENDPOINT_DATA,
  SET_SCHEMA_FIELDS,
  SET_SELECTED_ENDPOINT,
} from '../actions/actionTypes';

const initialState = {
  endpoint: {
    name: '',
    operation: -1,
    selectedSchema: '',
    authentication: false,
    paginated: false,
    sorted: false,
    inputs: [],
    queries: [],
    assignments: [],
  },
  schemaFields: [],
  selectedEndpoint: undefined,
};

const customEndpointsReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_SELECTED_ENDPOINT:
      return {
        ...state,
        selectedEndpoint: action.payload,
      };
    case SET_SCHEMA_FIELDS:
      return {
        ...state,
        schemaFields: action.payload,
      };
    case SET_ENDPOINT_DATA:
      return {
        ...state,
        endpoint: {
          ...state.endpoint,
          ...action.payload,
        },
      };
    case ENDPOINT_CLEAN_SLATE:
      return initialState;
    default:
      return state;
  }
};

export default customEndpointsReducer;
