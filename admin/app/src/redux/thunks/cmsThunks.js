import {
  deletedSchemaById,
  setCmsError,
  setCmsSchemas,
  setCustomEndpoints,
  setMoreCmsSchemas,
  setMoreSchemaDocumentsByName,
  setSchemaDocumentsByName,
  setSchemasFromModules,
  startCmsLoading,
  stopCmsLoading,
  updateSchemaStatus,
} from '../actions';
import {
  deleteCmsSchemaRequest,
  getCmsDocumentsByNameRequest,
  getCmsSchemasRequest,
  postCmsSchemaRequest,
  putCmsSchemaRequest,
  toggleSchemaByIdRequest,
  createSchemaDocumentRequest,
  deleteSchemaDocumentRequest,
  editSchemaDocumentRequest,
  schemasFromOtherModules,
} from '../../http/requests';
import {
  createCustomEndpointsRequest,
  deleteCustomEndpointsRequest,
  editCustomEndpointsRequest,
  getCustomEndpointsRequest,
} from '../../http/CustomEndpointsRequests';

export const getCmsSchemas = (limit = 30) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    getCmsSchemasRequest(0, limit)
      .then((res) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsSchemas(res.data));
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const getMoreCmsSchemas = () => {
  return (dispatch, getState) => {
    let SchemaLength = getState().cmsReducer.data.schemas.length;
    dispatch(startCmsLoading());
    getCmsSchemasRequest(SchemaLength, 20)
      .then((res) => {
        dispatch(stopCmsLoading());
        dispatch(setMoreCmsSchemas(res.data));
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const createNewSchema = (data) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    postCmsSchemaRequest(data)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const toggleSchema = (_id) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    toggleSchemaByIdRequest(_id)
      .then((res) => {
        dispatch(stopCmsLoading());
        dispatch(updateSchemaStatus(res.data));
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const editSchema = (_id, data) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    putCmsSchemaRequest(_id, data)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const deleteSelectedSchema = (_id) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    deleteCmsSchemaRequest(_id)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(deletedSchemaById(_id));
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const getSchemaDocuments = (name) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    getCmsDocumentsByNameRequest(name)
      .then((res) => {
        dispatch(stopCmsLoading());
        dispatch(setSchemaDocumentsByName(res.data));
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const getMoreSchemaDocuments = (name, skip) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    getCmsDocumentsByNameRequest(name, skip, 20)
      .then((res) => {
        dispatch(stopCmsLoading());
        dispatch(setMoreSchemaDocumentsByName(res.data));
        dispatch(setCmsError(null));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

const prepareDocumentField = (doc) => {
  let field = { [doc.name]: null };
  if (doc.fields) {
    doc.fields.forEach((subField) => {
      field[doc.name] = { ...field[doc.name], ...prepareDocumentField(subField) };
    });
  } else {
    field[doc.name] = doc.value;
  }
  return field;
};

export const createSchemaDocument = (schemaName, documentData) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    const body = {
      schemaName,
      inputDocument: {},
    };

    documentData.forEach((d) => {
      let field = prepareDocumentField(d);
      body.inputDocument = { ...body.inputDocument, ...field };
    });

    createSchemaDocumentRequest(schemaName, body)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError(null));
        dispatch(getSchemaDocuments(schemaName));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const deleteSchemaDocument = (schemaName, documentId) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    deleteSchemaDocumentRequest(schemaName, documentId)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError(null));
        dispatch(getSchemaDocuments(schemaName));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const editSchemaDocument = (schemaName, documentId, documentData) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    const body = {
      schemaName,
      id: documentId,
      changedDocument: {},
    };

    documentData.forEach((d) => {
      let field = prepareDocumentField(d);
      body.changedDocument = { ...body.changedDocument, ...field };
    });

    editSchemaDocumentRequest(schemaName, documentId, body)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError(null));
        dispatch(getSchemaDocuments(schemaName));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const getCustomEndpoints = () => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    getCustomEndpointsRequest()
      .then((res) => {
        const customEndpoints = res.data.results;
        dispatch(stopCmsLoading());
        dispatch(setCustomEndpoints(customEndpoints));
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
        console.log(err);
      });
  };
};

export const updateCustomEndpoints = (_id, endpointData) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    editCustomEndpointsRequest(_id, endpointData)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(getCustomEndpoints());
      })
      .catch((err) => {
        console.log(err);
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};

export const deleteCustomEndpoints = (_id) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    deleteCustomEndpointsRequest(_id)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(getCustomEndpoints());
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
        console.log(err);
      });
  };
};

export const createCustomEndpoints = (endPointData) => {
  return (dispatch) => {
    dispatch(startCmsLoading());
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
    createCustomEndpointsRequest(body)
      .then(() => {
        dispatch(stopCmsLoading());
        dispatch(getCustomEndpoints());
      })
      .catch((err) => {
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
        console.log(err);
      });
  };
};

export const fetchSchemasFromOtherModules = () => {
  return (dispatch) => {
    dispatch(startCmsLoading());
    schemasFromOtherModules()
      .then((res) => {
        dispatch(setSchemasFromModules(res.data.results));
      })
      .catch((err) => {
        console.log(err);
        dispatch(stopCmsLoading());
        dispatch(setCmsError({ err }));
      });
  };
};
