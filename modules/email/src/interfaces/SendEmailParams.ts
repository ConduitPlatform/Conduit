  import Mail from 'nodemailer/lib/mailer'
export interface ISendEmailParams {
  email: string;
  body?: string;
  subject?: string;
  variables: { [key: string]: any };
  sender: string;
  cc?: string[];
  replyTo?: string;
  attachments?: Mail.Attachment[];
}
