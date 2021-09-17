import axios from 'axios';
import { CONDUIT_API } from './requests';

export const getCmsSchemasRequest = (skip, limit) =>
  axios.get(`${CONDUIT_API}/admin/cms/schemas`, { params: { skip, limit } });

export const getCmsSchemaByIdRequest = (_id) =>
  axios.get(`${CONDUIT_API}/admin/cms/schemas${_id}`);

export const postCmsSchemaRequest = (data) =>
  axios.post(`${CONDUIT_API}/admin/cms/schemas`, { ...data });

export const putCmsSchemaRequest = (_id, data) =>
  axios.put(`${CONDUIT_API}/admin/cms/schemas/${_id}`, { ...data });

export const deleteCmsSchemaRequest = (_id) =>
  axios.delete(`${CONDUIT_API}/admin/cms/schemas/${_id}`);

export const toggleSchemaByIdRequest = (_id) =>
  axios.put(`${CONDUIT_API}/admin/cms/schemas/toggle/${_id}`);

export const getCmsDocumentsByNameRequest = (name, skip = 0, limit = 10) =>
  axios.get(`${CONDUIT_API}/admin/cms/content/${name}`, { params: { skip, limit } });

export const schemasFromOtherModules = () => {
  return axios.get(`${CONDUIT_API}/admin/cms/schemasFromOtherModules`);
};
