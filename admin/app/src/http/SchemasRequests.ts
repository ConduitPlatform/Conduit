import axios from 'axios';
import { CONDUIT_API } from './requests';

export const createSchemaDocumentRequest = (schemaName, documentData) =>
  axios.post(`${CONDUIT_API}/admin/cms/content/${schemaName}`, { ...documentData });

export const deleteSchemaDocumentRequest = (schemaName, documentId) =>
  axios.delete(`${CONDUIT_API}/admin/cms/schemas/${schemaName}/${documentId}`);

export const editSchemaDocumentRequest = (schemaName, documentId, documentData) =>
  axios.put(`${CONDUIT_API}/admin/cms/schemas/${schemaName}/${documentId}`, {
    ...documentData,
  });
