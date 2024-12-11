export interface IRegisterTemplateParams {
  name: string;
  subject: string;
  body: string;
  sender?: string;
  variables: string[];
  jsonTemplate?: string;
}
