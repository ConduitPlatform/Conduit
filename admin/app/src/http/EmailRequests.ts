import axios from 'axios';
import { CONDUIT_API } from './requestsConfig';
import { EmailSettings } from '../models/emails/EmailModels';

interface IEmailTemplateData {
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

interface ISendEmailData {
  subject: string;
  sender: string;
  email: string;
  body: string;
}

export const getEmailTemplateRequest = () => axios.get(`${CONDUIT_API}/admin/email/templates`);

export const postEmailTemplateRequest = (data: IEmailTemplateData) =>
  axios.post(`${CONDUIT_API}/admin/email/templates`, { ...data });

export const putEmailTemplateRequest = (templateId: string, data: IEmailTemplateData) =>
  axios.put(`${CONDUIT_API}/admin/email/templates/${templateId}`, { ...data });

export const getEmailSettingsRequest = () => axios.get(`${CONDUIT_API}/admin/config/email`);

export const putEmailSettingsRequest = (data: EmailSettings) =>
  axios.put(`${CONDUIT_API}/admin/config/email`, { ...data });

export const sendEmailRequest = (data: ISendEmailData) =>
  axios.post(`${CONDUIT_API}/admin/email/send`, { ...data });
