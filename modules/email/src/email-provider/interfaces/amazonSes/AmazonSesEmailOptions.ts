import Mail from 'nodemailer/lib/mailer';

export interface AmazonSesEmailOptions extends Mail.Options {
  template: string;
  templateData: string;
}
