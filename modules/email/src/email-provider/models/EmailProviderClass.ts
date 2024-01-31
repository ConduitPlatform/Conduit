import Mail from 'nodemailer/lib/mailer';
import { CreateEmailTemplate } from '../interfaces/CreateEmailTemplate.js';
import { DeleteEmailTemplate } from '../interfaces/DeleteEmailTemplate.js';
import { Template } from '../interfaces/Template.js';
import { UpdateEmailTemplate } from '../interfaces/UpdateEmailTemplate.js';
import { EmailBuilderClass } from './EmailBuilderClass.js';

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

  sendEmail(mailOptions: Mail.Options) {
    return this._transport?.sendMail(mailOptions);
  }
}
