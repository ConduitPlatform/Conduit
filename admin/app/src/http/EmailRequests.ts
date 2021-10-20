import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { EmailData, EmailSettings, SendEmailData } from '../models/emails/EmailModels';

export const getExternalTemplatesRequest = () =>
  axios.get(`${CONDUIT_API}/admin/email/externalTemplates`);

export const getEmailTemplateRequest = (skip: number, limit: number) =>
  axios.get(`${CONDUIT_API}/admin/email/templates`, { params: { skip, limit } });

export const postEmailTemplateRequest = (data: EmailData) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const putEmailTemplateRequest = (templateId: string, data: EmailData) =>
  axios.put(`${CONDUIT_API}/admin/email/templates/${templateId}`, { ...data });

export const deleteEmailTemplateRequest = (id: string) => {
  return axios.delete(`${CONDUIT_API}/admin/email/templates/${id}`);
};

export const deleteMultipleEmailTemplateRequest = (ids: string[]) => {
  return axios.delete(`${CONDUIT_API}/admin/email/templates`, { data: { ids: ids } });
};

export const syncExternalTemplates = () => {
  axios.put(`${CONDUIT_API}/admin/email/syncExternalTemplates`);
};

export const getEmailSettingsRequest = () => axios.get(`${CONDUIT_API}/admin/config/email`);

export const putEmailSettingsRequest = (data: EmailSettings) =>
  axios.put(`${CONDUIT_API}/admin/config/email`, { ...data });

export const sendEmailRequest = (data: SendEmailData) =>
  axios.post(`${CONDUIT_API}/admin/email/send`, { ...data });
