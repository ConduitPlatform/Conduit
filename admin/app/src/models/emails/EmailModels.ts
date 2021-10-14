export interface EmailTemplateType {
  body: string;
  name: string;
  subject: string;
  variables: string[];
  _id: string;
  updatedAt?: string;
  createdAt?: string;
}

export type whatever =
  | keyof MailgunSettings
  | keyof SmtpSettings
  | keyof MandrillSettings
  | keyof SendgridSettings;

export interface MailgunSettings {
  apiKey: string;
  domain: string;
  host: string;
}

export interface SmtpSettings {
  port: string;
  host: string;
  auth: {
    username: string;
    password: string;
    method: string;
  };
}

export interface MandrillSettings {
  apiKey: string;
}

export interface SendgridSettings {
  apiUser: string;
}

export enum TransportProviders {
  mailgun = 'mailgun',
  smtp = 'smtp',
  mandrill = 'mandrill',
  sendgrid = 'sendgrid',
}

export interface ITransportSettings {
  mailgun: MailgunSettings;
  smtp: SmtpSettings;
  mandrill: MandrillSettings;
  sendgrid: SendgridSettings;
}

export interface EmailSettings {
  active: boolean;
  sendingDomain: string;
  transport: TransportProviders;
  transportSettings: ITransportSettings;
}

export interface EmailData {
  body: string;
  name: string;
  subject: string;
  variables: string[];
}

export interface SendEmailData {
  templateName?: string;
  variables?: { [key: string]: string };
  subject?: string;
  sender: string;
  email: string;
  body: string;
}
