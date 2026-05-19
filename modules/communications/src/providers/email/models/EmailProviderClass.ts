import Mail from 'nodemailer/lib/mailer/index.js';
import {
  CreateEmailTemplate,
  DeleteEmailTemplate,
  UpdateEmailTemplate,
} from '../interfaces/index.js';
import { Template } from '../interfaces/Template.js';
import { EmailBuilderClass } from './EmailBuilderClass.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { SentMessageInfo } from 'nodemailer';

export abstract class EmailProviderClass {
  _transport?: Mail;

  constructor(transport: Mail) {
    this._transport = transport;
  }

  abstract listTemplates(): Promise<Template[]>;

  abstract getTemplateInfo(templateName: string): Promise<Template>;

  abstract createTemplate(data: CreateEmailTemplate): Promise<Template>;

  abstract getBuilder(): EmailBuilderClass<Mail.Options>;

  abstract updateTemplate(data: UpdateEmailTemplate): Promise<Template>;

  abstract deleteTemplate(id: string): Promise<DeleteEmailTemplate>;

  abstract getEmailStatus(messageId: string): Promise<Indexable>;

  abstract getMessageId(info: SentMessageInfo): string | undefined;

  sendEmail(mailOptions: Mail.Options) {
    return this._transport?.sendMail(mailOptions);
  }
}
