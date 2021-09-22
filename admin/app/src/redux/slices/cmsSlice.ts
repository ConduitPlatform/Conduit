import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  deleteCmsSchemaRequest,
  getCmsDocumentsByNameRequest,
  getCmsSchemasRequest,
  postCmsSchemaRequest,
  putCmsSchemaRequest,
  schemasFromOtherModules,
  toggleSchemaByIdRequest,
} from '../../http/CmsRequests';
import {
  createSchemaDocumentRequest,
  editSchemaDocumentRequest,
  deleteSchemaDocumentRequest,
} from '../../http/SchemasRequests';
import {
  getCustomEndpointsRequest,
  createCustomEndpointsRequest,
  editCustomEndpointsRequest,
  deleteCustomEndpointsRequest,
} from '../../http/CustomEndpointsRequests';
import { EndpointTypes, Schema, ToggleSchma } from '../../models/cms/CmsModels';

export interface ICmsSlice {
  data: {
    schemas: Schema[];
    schemasFromOtherModules: Schema[];
    documents: {
      documents: any;
    };
    customEndpoints: EndpointTypes[];
    count: number;
    config: any;
    selectedSchema: Schema | null;
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
    documents: {
      documents: [],
    },
    customEndpoints: [],
    count: 0,
    config: null,
    selectedSchema: null,
  },
  meta: { loading: false, error: null },
};

export const asyncGetCmsSchemas = createAsyncThunk<
  { results: Schema[]; documentsCount: number },
  number
>('cms/getSchemas', async (limit = 30) => {
  try {
    const { data } = await getCmsSchemasRequest(0, limit);

    return {
      results: data.results as Schema[],
      documentsCount: data.documentsCount as number,
    };
  } catch (error) {
    throw error;
  }
});

export const asyncGetMoreCmsSchemas = createAsyncThunk<
  { results: Schema[]; documentsCount: number },
  any
>('cms/getMoreSchemas', async (arg, thunkApi: any) => {
  try {
    const SchemaLength = thunkApi.getState().cmsSlice.data.schemas.length;
    const { data } = await getCmsSchemasRequest(SchemaLength, 20);
    return {
      results: data.results as Schema[],
      documentsCount: data.documentsCount as number,
    };
  } catch (error) {
    throw error;
  }
});

export const asyncCreateNewSchema = createAsyncThunk<Schema, any>(
  'cms/createNewSchema',
  async (dataForSchema) => {
    try {
      const { data } = await postCmsSchemaRequest(dataForSchema);

      return data as Schema;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncToggleSchema = createAsyncThunk<ToggleSchma, string>(
  'cms/toggleSchema',
  async (_id) => {
    try {
      const { data } = await toggleSchemaByIdRequest(_id);
      return data as ToggleSchma;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncEditSchema = createAsyncThunk<any, { _id: string; data: any }>(
  'cms/editSchema',
  async (params) => {
    try {
      await putCmsSchemaRequest(params._id, params.data);
    } catch (error) {
      throw error;
    }
  }
);

export const asyncDeleteSelectedSchema = createAsyncThunk<string, { _id: string }>(
  'cms/deleteSchema',
  async (args) => {
    try {
      await deleteCmsSchemaRequest(args._id);
      return args._id;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetSchemaDocuments = createAsyncThunk<any, string>(
  'cms/getDocs',
  async (name) => {
    try {
      const { data } = await getCmsDocumentsByNameRequest(name);

      return data;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetMoreSchemaDocuments = createAsyncThunk<
  any,
  { name: string; skip: number }
>('cms/getMoreDocs', async (params) => {
  try {
    const { data } = await getCmsDocumentsByNameRequest(params.name, params.skip, 20);
    return data;
  } catch (error) {
    throw error;
  }
});

const prepareDocumentField = (doc: any) => {
  let field = { [doc.name]: null };
  if (doc.fields) {
    doc.fields.forEach((subField: any) => {
      const tempObj = field[doc.name];
      const preppedFields = prepareDocumentField(subField);
      field[doc.name] = Object.assign({ tempObj, ...preppedFields });
    });
  } else {
    field[doc.name] = doc.value;
  }
  return field;
};

export const asyncCreateSchemaDocument = createAsyncThunk<
  any,
  { schemaName: string; document: any }
>('cms/createDoc', async (params, thunkApi) => {
  try {
    const body = { schemaName: params.schemaName, inputDocument: {} };
    params.document.forEach((d: any) => {
      let field = prepareDocumentField(d);
      body.inputDocument = { ...body.inputDocument, ...field };
    });

    await createSchemaDocumentRequest(params.schemaName, body);
    thunkApi.dispatch(asyncGetSchemaDocuments(params.schemaName));
    return;
  } catch (error) {
    throw error;
  }
});

export const asyncDeleteSchemaDocument = createAsyncThunk<
  any,
  { schemaName: string; documentId: string }
>('cms/deleteDoc', async (params, thunkApi) => {
  try {
    await deleteSchemaDocumentRequest(params.schemaName, params.documentId);
    thunkApi.dispatch(asyncGetSchemaDocuments(params.schemaName));
  } catch (error) {
    throw error;
  }
});

export const asyncEditSchemaDocument = createAsyncThunk(
  'cms/editDoc',
  async (
    params: { schemaName: string; documentId: string; documentData: any },
    thunkApi
  ) => {
    try {
      const body = {
        schemaName: params.schemaName,
        id: params.documentId,
        changedDocument: {},
      };

      params.documentData.forEach((d: any) => {
        let field = prepareDocumentField(d);
        body.changedDocument = { ...body.changedDocument, ...field };
      });

      await editSchemaDocumentRequest(params.schemaName, params.documentId, body);
      thunkApi.dispatch(asyncGetSchemaDocuments(params.schemaName));
      return params.schemaName;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncGetCustomEndpoints = createAsyncThunk<EndpointTypes[], any>(
  'cms/getEndpoints',
  async () => {
    try {
      const { data } = await getCustomEndpointsRequest();

      return data.results as EndpointTypes[];
    } catch (error) {
      throw error;
    }
  }
);

export const asyncUpdateCustomEndpoints = createAsyncThunk<
  any,
  { _id: string; endpointData: any }
>('cms/updateEndpoints', async (params, thunkApi) => {
  try {
    const { data } = await editCustomEndpointsRequest(params._id, params.endpointData);
    thunkApi.dispatch(asyncGetCustomEndpoints(''));

    return data;
  } catch (error) {
    throw error;
  }
});

export const asyncDeleteCustomEndpoints = createAsyncThunk<any, string>(
  'cms/deleteEndpoints',
  async (_id, thunkApi) => {
    try {
      const { data } = await deleteCustomEndpointsRequest(_id);
      thunkApi.dispatch(asyncGetCustomEndpoints(''));

      return data.results;
    } catch (error) {
      throw error;
    }
  }
);

export const asyncCreateCustomEndpoints = createAsyncThunk<any, any>(
  'cms/createEndpoints',
  async (endPointData, thunkApi) => {
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
      thunkApi.dispatch(asyncGetCustomEndpoints(''));
    } catch (error) {
      throw error;
    }
  }
);

export const asyncFetchSchemasFromOtherModules = createAsyncThunk<any, any>(
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
    builder.addCase(asyncGetCmsSchemas.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncGetCmsSchemas.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = action.error as Error;
    });
    builder.addCase(asyncGetCmsSchemas.fulfilled, (state, action) => {
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
      state.data.schemas.push(...action.payload.results);
      state.data.count = action.payload.documentsCount;
    });
    builder.addCase(asyncCreateNewSchema.pending, (state) => {
      state.meta.loading = true;
    });
    builder.addCase(asyncCreateNewSchema.rejected, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
    });
    builder.addCase(asyncCreateNewSchema.fulfilled, (state, action) => {
      state.meta.loading = false;
      state.meta.error = null;
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
      state.data.schemas = deleteSchemaStatusById(action.payload, state.data.schemas);
      state.meta.error = null;
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
      state.data.documents = action.payload;
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
      state.data.documents.documents.push(...action.payload.documents);
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
      state.data.customEndpoints = action.payload;
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
export const { setSelectedSchema, clearSelectedSchema } = cmsSlice.actions;
