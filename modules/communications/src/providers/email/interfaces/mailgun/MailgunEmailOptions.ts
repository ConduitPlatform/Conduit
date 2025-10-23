import Mail from 'nodemailer/lib/mailer/index.js';

export interface MailgunEmailOptions extends Mail.Options {
  template?: string;

  [key: string]: any;
}
