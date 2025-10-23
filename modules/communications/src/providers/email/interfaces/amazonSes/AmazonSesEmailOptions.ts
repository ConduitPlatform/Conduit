import Mail from 'nodemailer/lib/mailer/index.js';

export interface AmazonSesEmailOptions extends Mail.Options {
  template: string;
  templateData: string;
}
