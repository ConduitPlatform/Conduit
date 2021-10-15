import axios from 'axios';
import { FormSettingsConfig, FormsModel } from '../models/forms/FormsModels';
import { CONDUIT_API } from './requestsConfig';

export const getForms = () => axios.get(`${CONDUIT_API}/admin/forms/get`);

export const createForm = (data: FormsModel) => axios.post(`${CONDUIT_API}/admin/forms/post`, data);

export const getFormReplies = (id: string) => axios.get(`${CONDUIT_API}/admin/forms/repiies/${id}`);

export const updateForm = (id: string, data: FormsModel) =>
  axios.put(`${CONDUIT_API}/admin/forms/update/${id}`, data);

export const getFormsConfig = () => axios.get(`${CONDUIT_API}/admin/config/forms`);

export const updateFormsConfig = (body: FormSettingsConfig) =>
  axios.put(`${CONDUIT_API}/admin/config/forms`, body);
