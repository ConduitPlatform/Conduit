import Mail from 'nodemailer/lib/mailer';

export interface SendgridMailOptions extends Mail.Options {
  templateId: string;
  dynamicTemplateData: {
    [key: string]: any;
  };
}
