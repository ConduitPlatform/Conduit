import {
  CLEAR_CMS_SELECTED_SCHEMA,
  CLEAR_SELECTED_SCHEMA,
  DELETE_CMS_SCHEMAS,
  SET_CMS_ERROR,
  SET_CMS_SCHEMA_DOCUMENTS,
  SET_CMS_SCHEMAS,
  SET_SELECTED_SCHEMA,
  START_CMS_LOADING,
  STOP_CMS_LOADING,
  UPDATE_SCHEMAS_STATUS,
} from '../actions/actionTypes';

const initialState = {
  data: {
    schemas: [],
    documents: [],
    customEndpoints: [
      {
        name: 'Endpoint 1',
        id: 1,
        inputs: [{ name: 'Test', type: 'String', location: 'Body' }],
        queries: [{ schemaField: 'Test', operation: 'String', comparisonField: { type: '', value: '' } }],
      },
      {
        name: 'Endpoint 2',
        id: 2,
        inputs: [{ name: 'Test', type: 'String', location: 'Body' }],
        queries: [{ schemaField: 'Test', operation: 'String', comparisonField: { type: '', value: '' } }],
      },
    ],
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
          schemas: action.payload.results,
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
