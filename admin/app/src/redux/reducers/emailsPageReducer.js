import {
  ADD_EMAIL_TEMPLATE,
  SET_EMAIL_ERROR,
  SET_EMAIL_SETTINGS,
  SET_EMAIL_TEMPLATES,
  START_EMAIL_LOADING,
  STOP_EMAIL_LOADING,
  UPDATE_EMAIL_TEMPLATE,
  CLEAR_EMAIL_PAGE_STORE,
} from '../actions/actionTypes';

const initialState = {
  data: { templateDocuments: null, totalCount: 0, settings: null },
  loading: false,
  error: null,
};

const emailsPageReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_EMAIL_TEMPLATES:
      return {
        ...state,
        data: {
          ...state.data,
          templateDocuments: action.payload.templateDocuments,
          totalCount: action.payload.totalCount,
        },
      };
    case START_EMAIL_LOADING:
      return {
        ...state,
        loading: true,
      };
    case STOP_EMAIL_LOADING:
      return {
        ...state,
        loading: false,
      };
    case SET_EMAIL_ERROR:
      return {
        ...state,
        error: action.payload.error,
      };
    case UPDATE_EMAIL_TEMPLATE:
      return {
        ...state,
        data: {
          ...state.data,
          templateDocuments: updateTemplateByID(
            action.payload,
            state.data.templateDocuments
          ),
        },
      };
    case ADD_EMAIL_TEMPLATE:
      return {
        ...state,
        data: {
          ...state.data,
          totalCount: state.data.totalCount++,
          templateDocuments: [...state.data.templateDocuments, action.payload],
        },
      };
    case SET_EMAIL_SETTINGS:
      return {
        ...state,
        data: {
          ...state.data,
          settings: action.payload,
        },
      };
    case CLEAR_EMAIL_PAGE_STORE:
      return {
        ...initialState,
      };
    default:
      return state;
  }
};

const updateTemplateByID = (updated, templates) => {
  return templates.map((t) => {
    if (t._id === updated._id) {
      return {
        ...updated,
      };
    } else {
      return t;
    }
  });
};

export default emailsPageReducer;
