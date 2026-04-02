import { Indexable } from '@conduitplatform/grpc-sdk';
import { Attachment } from 'nodemailer/lib/mailer';

export interface ISendEmailParams {
  email: string;
  body?: string;
  subject?: string;
  variables: Indexable;
  sender: string;
  cc?: string[];
  replyTo?: string;
  attachments?: Attachment[];
}
