import {
  CLEAR_SELECTED_SCHEMA,
  DELETE_CMS_SCHEMAS,
  SET_CMS_ERROR,
  SET_CMS_SCHEMA_DOCUMENTS,
  SET_CMS_SCHEMAS,
  SET_SELECTED_SCHEMA,
  START_CMS_LOADING,
  STOP_CMS_LOADING,
  UPDATE_SCHEMAS_STATUS,
  SET_CUSTOM_ENDPOINTS,
  SET_MORE_DOCUMENTS_BY_NAME,
  SET_CMS_MORE_SCHEMAS,
} from '../actions/actionTypes';

const initialState = {
  data: {
    schemas: [],
    documents: {
      documents: [],
    },
    customEndpoints: [],
    count: 0,
    config: null,
    selectedSchema: null,
  },
  loading: false,
  error: null,
};

const cmsReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_CMS_SCHEMAS:
      return {
        ...state,
        data: {
          ...state.data,
          schemas: [...action.payload.results],
          count: action.payload.documentsCount,
        },
      };
    case SET_CMS_MORE_SCHEMAS:
      return {
        ...state,
        data: {
          ...state.data,
          schemas: [...state.data.schemas, ...action.payload.results],
          count: action.payload.documentsCount,
        },
      };
    case SET_CMS_SCHEMA_DOCUMENTS:
      return {
        ...state,
        data: {
          ...state.data,
          documents: action.payload,
        },
      };
    case SET_MORE_DOCUMENTS_BY_NAME:
      return {
        ...state,
        data: {
          ...state.data,
          documents: {
            ...state.data.documents,
            documents: [...state.data.documents.documents, ...action.payload.documents],
          },
        },
      };
    case START_CMS_LOADING:
      return {
        ...state,
        loading: true,
      };
    case STOP_CMS_LOADING:
      return {
        ...state,
        loading: false,
      };
    case SET_CMS_ERROR:
      return {
        ...state,
        error: action.payload.error,
      };
    case SET_SELECTED_SCHEMA:
      return {
        ...state,
        data: {
          ...state.data,
          selectedSchema: findSchemaById(action.payload, state.data.schemas),
        },
      };
    case CLEAR_SELECTED_SCHEMA:
      return {
        ...state,
        data: {
          ...state.data,
          selectedSchema: null,
        },
      };
    case UPDATE_SCHEMAS_STATUS:
      return {
        ...state,
        data: {
          ...state.data,
          schemas: updateSchemaStatusByName(action.payload, state.data.schemas),
        },
      };
    case DELETE_CMS_SCHEMAS:
      return {
        ...state,
        data: {
          ...state.data,
          schemas: deleteSchemaStatusById(action.payload, state.data.schemas),
        },
      };
    case SET_CUSTOM_ENDPOINTS:
      return {
        ...state,
        data: {
          ...state.data,
          customEndpoints: action.payload,
        },
      };
    default:
      return state;
  }
};

const findSchemaById = (_id, schemas) => {
  const found = schemas.find((s) => s._id === _id);
  return found ? found : null;
};

const updateSchemaStatusByName = (updated, schemas) => {
  return schemas.map((schema) => {
    if (schema.name === updated.name) {
      return {
        ...schema,
        enabled: updated.enabled,
      };
    } else {
      return schema;
    }
  });
};

const deleteSchemaStatusById = (deleted, schemas) => {
  return schemas.filter((schema) => {
    return schema._id !== deleted;
  });
};

export default cmsReducer;
