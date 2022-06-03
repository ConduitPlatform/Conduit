import Mail from 'nodemailer/lib/mailer';

export interface MailgunEmailOptions extends Mail.Options {
  template?: string;
  [key: string]: any;
}
