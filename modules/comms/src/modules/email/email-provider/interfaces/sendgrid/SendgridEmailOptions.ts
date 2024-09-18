import Mail from 'nodemailer/lib/mailer';
import { Indexable } from '@conduitplatform/grpc-sdk';

export interface SendgridMailOptions extends Mail.Options {
  templateId: string;
  dynamicTemplateData: Indexable;
}
