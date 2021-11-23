import axios from 'axios';
import { FormSettingsConfig, FormsModel } from '../models/forms/FormsModels';
import { CONDUIT_API } from './requestsConfig';
import { Pagination, Search } from '../models/http/HttpModels';

export const getForms = (params: Pagination & Search) =>
  axios.get(`${CONDUIT_API}/admin/forms/get`, {
    params,
  });

export const createForm = (data: any) => axios.post(`${CONDUIT_API}/admin/forms/new`, data);

export const deleteFormsRequest = (ids: string[]) => {
  return axios.delete(`${CONDUIT_API}/admin/forms/delete`, { data: { ids: ids } });
};

export const getFormReplies = (id: string) => axios.get(`${CONDUIT_API}/admin/forms/replies/${id}`);

export const updateForm = (id: string, data: FormsModel) =>
  axios.put(`${CONDUIT_API}/admin/forms/update/${id}`, data);

export const getFormsConfig = () => axios.get(`${CONDUIT_API}/admin/config/forms`);

export const updateFormsConfig = (body: FormSettingsConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/forms`, body);
