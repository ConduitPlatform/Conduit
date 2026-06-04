export interface MailgunTemplate {
  template: {
    name: string;
    description: string;
    createdAt: string;
    createdBy: string;
    id: string;
    version: {
      tag: string;
      template: string;
      engine: string;
      mjml: string;
      createdAt: string;
      comment: string;
      active: boolean;
      id: string;
    };
  };
  description?: string;
}
