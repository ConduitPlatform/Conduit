import axios from 'axios';
import { FormSettingsConfig, FormsModel } from '../models/forms/FormsModels';
import { CONDUIT_API } from './requestsConfig';

export const getForms = (skip: number, limit: number) =>
  axios.get(`${CONDUIT_API}/admin/forms/get`, { params: { skip, limit } });

export const createForm = (data: any) => axios.post(`${CONDUIT_API}/admin/forms/new`, data);

export const deleteFormRequest = (id: string) => {
  return axios.delete(`${CONDUIT_API}/admin/forms/${id}`);
};

export const deleteMultipleFormsRequest = (ids: string[]) => {
  return axios.delete(`${CONDUIT_API}/admin/forms`, { data: { ids: ids } });
};

export const getFormReplies = (id: string) => axios.get(`${CONDUIT_API}/admin/forms/replies/${id}`);

export const updateForm = (id: string, data: FormsModel) =>
  axios.put(`${CONDUIT_API}/admin/forms/update/${id}`, data);

export const getFormsConfig = () => axios.get(`${CONDUIT_API}/admin/config/forms`);

export const updateFormsConfig = (body: FormSettingsConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/forms`, body);
