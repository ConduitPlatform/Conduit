import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createCustomEndpointsRequest,
  createSchemaDocumentRequest,
  deleteCmsSchemaRequest,
  deleteCustomEndpointsRequest,
  deleteSchemaDocumentRequest,
  editCustomEndpointsRequest,
  editSchemaDocumentRequest,
  getCmsDocumentsByNameRequest,
  getCmsSchemasRequest,
  getCustomEndpointsRequest,
  postCmsSchemaRequest,
  putCmsSchemaRequest,
  schemasFromOtherModules,
  toggleSchemaByIdRequest,
} from '../../http/requests';
import { Schema } from '../../models/cms/CmsModels';
import { RootState, store } from '../store';

interface ICmsSlice {
  data: {
    schemas: Schema[];
    schemasFromOtherModules: any;
    schemaDocuments: {
      schemaDocuments: any;
    };
    customEndpoints: any;
    count: number;
    config: any;
    selectedSchema: any;
  };
  meta: {
    loading: boolean;
    error: Error | null;
  };
}

const initialState: ICmsSlice = {
  data: {
    schemas: [],
    schemasFromOtherModules: [],
    schemaDocuments: {
      schemaDocuments: [],
    },
    customEndpoints: [],
    count: 0,
    config: null,
    selectedSchema: null,
  },
  meta: { loading: false, error: null },
};

export const asynGetCmsSchemas = createAsyncThunk(
  'cms/getSchemas',
  async (limit: number = 30) => {
    try {
      const { data } = await getCmsSchemasRequest(0, limit);
      return data;
    } catch (error) {
      throw error;
    }
  }
);
type RootState = ReturnType<typeof store.getState>;
export const asyncGetMoreCmsSchemas = createAsyncThunk<RootState>(
  'cms/getMoreSchemas',
  async (arg, thunkApi: any) => {
    try {
      //not sure if this is the correct/optimal way to grab the state
      //also we need to make the arg optional, didn't find a way to do that for now with typescript/toolkit
      const SchemaLength = thunkApi.getState().cmsSlice.data.schemas.length;
      const { data } = await getCmsSchemasRequest(SchemaLength, 20);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncCreateNewSchema = createAsyncThunk(
  'cms/createNewSchema',
  async (dataForSchema: any) => {
    try {
      const { data } = await postCmsSchemaRequest(dataForSchema);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncToggleSchema = createAsyncThunk(
  'cms/toggleSchema',
  async (_id: string) => {
    try {
      const { data } = await toggleSchemaByIdRequest(_id);

      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncEditSchema = createAsyncThunk(
  'cms/editSchema',
  async (params: { _id: string; data: any }) => {
    try {
      const { data } = await putCmsSchemaRequest(params._id, params.data);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncDeleteSelectedSchema = createAsyncThunk(
  'cms/deleteSchema',
  async (_id: string) => {
    try {
      const { data } = await deleteCmsSchemaRequest(_id);

      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetSchemaDocuments = createAsyncThunk(
  'cms/getDocs',
  async (name: string) => {
    try {
      const { data } = await getCmsDocumentsByNameRequest(name);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetMoreSchemaDocuments = createAsyncThunk(
  'cms/getMoreDocs',
  async (params: { name: string; skip: number }) => {
    try {
      const { data } = await getCmsDocumentsByNameRequest(params.name, params.skip, 20);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

const prepareDocumentField = (doc: any) => {
  let field = { [doc.name]: null };
  if (doc.fields) {
    doc.fields.forEach((subField: any) => {
      field[doc.name] = { ...field[doc.name], ...prepareDocumentField(subField) };
    });
  } else {
    field[doc.name] = doc.value;
  }
  return field;
};

export const asyncCreateSchemaDocument = createAsyncThunk(
  'cms/createDoc',
  async (params: { schemaName: string; documentData: any }) => {
    try {
      const body = { schemaName: params.schemaName, inputDocument: {} };
      params.documentData.forEach((d: any) => {
        let field = prepareDocumentField(d);
        body.inputDocument = { ...body.inputDocument, ...field };
      });
      await createSchemaDocumentRequest(params.schemaName, body);
      return;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncDeleteSchemaDocument = createAsyncThunk(
  'cms/deleteDoc',
  async (params: { schemaName: string; documentId: string }) => {
    try {
      await deleteSchemaDocumentRequest(params.schemaName, params.documentId);
      return params.schemaName;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncEditSchemaDocument = createAsyncThunk(
  'cms/editDoc',
  async (params: { schemaName: string; documentId: string; documentData: any }) => {
    try {
      const body = {
        schemaName: params.schemaName,
        id: params.documentId,
        changedDocument: {},
      };

      params.documentData.forEach((d) => {
        let field = prepareDocumentField(d);
        body.changedDocument = { ...body.changedDocument, ...field };
      });

      await editSchemaDocumentRequest(params.schemaName, params.documentId, body);
      return params.schemaName;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetCustomEndpoints = createAsyncThunk('cms/getEndpoints', async () => {
  try {
    const { data } = await getCustomEndpointsRequest();

    return data;
  } catch (error) {
    throw error;
  }
});

export const asyncUpdateCustomEndpoints = createAsyncThunk(
  'cms/updateEndpoints',
  async (params: { _id: string; endpointData: any }) => {
    try {
      const { data } = await editCustomEndpointsRequest(params._id, params.endpointData);

      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncDeleteCustomEndpoints = createAsyncThunk(
  'cms/deleteEndpoints',
  async (_id: string, thunkApi) => {
    try {
      const { data } = await deleteCustomEndpointsRequest(_id);
      thunkApi.dispatch(asyncGetCustomEndpoints);
      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncCreateCustomEndpoints = createAsyncThunk(
  'cms/createEndpoints',
  async (endPointData: any, thunkApi) => {
    try {
      const body = {
        name: endPointData.name,
        operation: endPointData.operation,
        selectedSchema: endPointData.selectedSchema,
        authentication: endPointData.authentication,
        paginated: endPointData.paginated,
        sorted: endPointData.sorted,
        inputs: endPointData.inputs,
        query: endPointData.query,
        assignments: endPointData.assignments,
      };
      await createCustomEndpointsRequest(body);
    } catch (error) {
      throw error;
    }
  }
);

export const asyncFetchSchemasFromOtherModules = createAsyncThunk(
  'cms/schemasFromOtherModules',
  async ({}, thunkApi) => {
    try {
      const { data } = await schemasFromOtherModules();
      return data;
    } catch (error) {
      throw error;
    }
  }
);

const findSchemaById = (_id: string, schemas: any) => {
  const found = schemas.find((s: any) => s._id === _id);
  return found ? found : null;
};

const updateSchemaStatusByName = (updated: any, schemas: any) => {
  return schemas.map((schema: any) => {
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

const deleteSchemaStatusById = (deleted: any, schemas: any) => {
  return schemas.filter((schema: any) => {
    return schema._id !== deleted;
  });
};

const cmsSlice = createSlice({
  name: 'cms',
  initialState,
  reducers: {
    setSelectedSchema(state, action) {
      state.data.selectedSchema = findSchemaById(action.payload, state.data.schemas);
    },
    clearSelectedSchema(state) {
      state.data.selectedSchema = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(asynGetCmsSchemas.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asynGetCmsSchemas.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asynGetCmsSchemas.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.schemas = action.payload.results;
      state.data.count = action.payload.documentsCount;
    });
    builder.addCase(asyncGetMoreCmsSchemas.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetMoreCmsSchemas.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetMoreCmsSchemas.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.schemas.push(action.payload.results);
      state.data.count = action.payload.documentsCount;
    });
    builder.addCase(asyncCreateNewSchema.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncCreateNewSchema.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncCreateNewSchema.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.config = action.payload;
    });
    builder.addCase(asyncToggleSchema.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncToggleSchema.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncToggleSchema.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.schemas = updateSchemaStatusByName(action.payload, state.data.schemas);
    });
    builder.addCase(asyncEditSchema.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncEditSchema.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncEditSchema.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
    builder.addCase(asyncDeleteSelectedSchema.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncDeleteSelectedSchema.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncDeleteSelectedSchema.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.config = action.payload;
      state.data.schemas = deleteSchemaStatusById(action.payload, state.data.schemas);
    });
    builder.addCase(asyncGetSchemaDocuments.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetSchemaDocuments.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetSchemaDocuments.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.schemaDocuments = action.payload;
    });
    builder.addCase(asyncGetMoreSchemaDocuments.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetMoreSchemaDocuments.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetMoreSchemaDocuments.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
      state.data.schemaDocuments.schemaDocuments = action.payload.documents;
    });
    builder.addCase(asyncCreateSchemaDocument.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncCreateSchemaDocument.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncCreateSchemaDocument.fulfilled, (state, action) => {
      state.meta.loading = false;
    });
    builder.addCase(asyncDeleteSchemaDocument.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncDeleteSchemaDocument.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncDeleteSchemaDocument.fulfilled, (state) => {
      state.meta.loading = false;
    });
    builder.addCase(asyncEditSchemaDocument.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncEditSchemaDocument.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncEditSchemaDocument.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
    builder.addCase(asyncGetCustomEndpoints.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetCustomEndpoints.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetCustomEndpoints.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.config = action.payload.results;
    });
    builder.addCase(asyncUpdateCustomEndpoints.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncUpdateCustomEndpoints.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncUpdateCustomEndpoints.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
    builder.addCase(asyncDeleteCustomEndpoints.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncDeleteCustomEndpoints.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncDeleteCustomEndpoints.fulfilled, (state, action) => {
      state.meta.loading = false;
    });
    builder.addCase(asyncCreateCustomEndpoints.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncCreateCustomEndpoints.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncCreateCustomEndpoints.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
    builder.addCase(asyncFetchSchemasFromOtherModules.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncFetchSchemasFromOtherModules.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncFetchSchemasFromOtherModules.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.data.schemasFromOtherModules = action.payload.results;
    });
  },
});

export default cmsSlice.reducer;
