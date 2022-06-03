import Mail from 'nodemailer/lib/mailer';
import { CreateEmailTemplate } from '../interfaces/CreateEmailTemplate';
import { DeleteEmailTemplate } from '../interfaces/DeleteEmailTemplate';
import { Template } from '../interfaces/Template';
import { UpdateEmailTemplate } from '../interfaces/UpdateEmailTemplate';
import { EmailBuilderClass } from './EmailBuilderClass';

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
