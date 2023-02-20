export interface TemplateDocument {
  _id: string;
  name: string;
  subject?: string;
  body: string;
  createdAt: string;
  variables?: string[];
}
