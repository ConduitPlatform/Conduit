export interface ISendEmailParams {
  email: string;
  body?: string,
  subject?: string,
  variables: { [key: string]: any };
  sender: string;
  cc?: string[];
  replyTo?: string;
  attachments?: string[];
}
