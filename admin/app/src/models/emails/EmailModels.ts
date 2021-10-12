export interface EmailTemplateType {
  body: string;
  name: string;
  subject: string;
  variables: string[];
  _id: string;
  updatedAt?: string;
  createdAt?: string;
}

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

export interface EmailSettings {
  active: boolean;
  sendingDomain: string;
  transport: string;
  transportSettings: {
    mailgun?: MailgunSettings;
    smtp?: SmtpSettings;
    mandrill?: MandrillSettings;
    sendgrid?: SendgridSettings;
  };
}

export interface EmailSettingsState {
  active: boolean;
  sendingDomain: string;
  transport: string;
  transportSettings: {
    mailgun?: MailgunSettings;
    smtp?: SmtpSettings;
    mandrill?: MandrillSettings;
    sendgrid?: SendgridSettings;
  };
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
