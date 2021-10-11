import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { EmailData, EmailSettings, SendEmailData } from '../models/emails/EmailModels';

export const getEmailTemplateRequest = () => axios.get(`${CONDUIT_API}/admin/email/templates`);

export const postEmailTemplateRequest = (data: EmailData) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const putEmailTemplateRequest = (templateId: string, data: EmailData) =>
  axios.put(`${CONDUIT_API}/admin/email/templates/${templateId}`, { ...data });

export const getEmailSettingsRequest = () => axios.get(`${CONDUIT_API}/admin/config/email`);

export const putEmailSettingsRequest = (data: EmailSettings) =>
  axios.put(`${CONDUIT_API}/admin/config/email`, { ...data });

export const sendEmailRequest = (data: SendEmailData) =>
  axios.post(`${CONDUIT_API}/admin/email/send`, { ...data });
