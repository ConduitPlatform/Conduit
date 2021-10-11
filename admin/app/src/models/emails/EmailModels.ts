export interface EmailTemplateType {
  body: string;
  name: string;
  subject: string;
  variables: string[];
  _id: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface TransportSettings {
  apiKey: string;
  domain: string;
  host: string;
}

export interface EmailSettings {
  active: boolean;
  doc?: string;
  sendingDomain: string;
  transport: string;
  transportSettings: {
    mailgun?: TransportSettings;
    smtp?: TransportSettings;
  };
}

export interface EmailSettingsState {
  active: boolean;
  sendingDomain: string;
  transport: string;
  transportSettings: {
    apiKey: string;
    domain: string;
    host: string;
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
