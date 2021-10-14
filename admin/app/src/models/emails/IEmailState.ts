export interface IEmailState {
  _id?: string;
  email: string;
  sender: string;
  subject: string;
  body: string;
  variables: string[];
  variablesValues: { [key: string]: string };
  templateName: string;
}
