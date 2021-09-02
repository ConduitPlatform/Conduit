export interface TemplateDocument {
  body: string;
  createdAt: string;
  name: string;
  subject: string;
  updatedAt: string;
}

export interface EmailSettings {
  active: boolean;
  doc: string;
  sendingDomain: string;
  transport: string;
  transportSettings: {
    mailgun: {
      apiKey: string;
      domain: string;
      host: string;
    };
  };
}

export interface EmailData {
  settings: EmailSettings;
  templateDocuments: TemplateDocument[];
  variables: string[];
}

export interface EmailTemplateType {
  body: string;
  name: string;
  subject: string;
  variables: string[];
  _id: string;
}
