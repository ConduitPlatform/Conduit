export interface ISendEmailParams {
  email: string;
  variables: { [key: string]: any };
  sender: string;
  cc?: string[];
  replyTo?: string;
  attachments?: string[];
}
