export interface EmailTemplateType {
  body: string;
  name: string;
  subject: string;
  variables: string[];
  _id?: string;
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
  settings: EmailSettings;
  templateDocuments: EmailTemplateType[];
  variables: string[];
}

export interface EmailState {
  email: string;
  sender: string;
  subject: string;
  body: string;
  template: string;
  variables: [];
  variablesValues: { [key: string]: string };
  templateName: string;
}

export interface EmailUI {
  _id: string;
  Name: string;
  External: string;
  Synced: string;
  'Updated At': string;
}
