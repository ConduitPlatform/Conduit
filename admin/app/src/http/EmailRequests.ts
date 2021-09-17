import axios from 'axios';
import { CONDUIT_API } from './requests';

export const getEmailTemplateRequest = () =>
  axios.get(`${CONDUIT_API}/admin/email/templates`);

export const postEmailTemplateRequest = (data) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const putEmailTemplateRequest = (templateId, data) =>
  axios.put(`${CONDUIT_API}/admin/email/templates/${templateId}`, { ...data });

export const getEmailSettingsRequest = () =>
  axios.get(`${CONDUIT_API}/admin/config/email`);

export const putEmailSettingsRequest = (data) =>
  axios.put(`${CONDUIT_API}/admin/config/email`, { ...data });

export const sendEmailRequest = (data) =>
  axios.post(`${CONDUIT_API}/admin/email/send`, { ...data });
