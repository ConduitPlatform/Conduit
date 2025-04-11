import { EmailProviderClass } from '../../models/EmailProviderClass.js';
import { MailersendConfig } from './mailersend.config.js';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { MailerSend } from 'mailersend';
import { Template } from '../../interfaces/Template.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { Options } from 'nodemailer/lib/mailer/index.js';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate.js';
import { DeleteEmailTemplate } from '../../interfaces/DeleteEmailTemplate.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { MailersendBuilder } from './mailersendBuilder.js';
import { to } from 'await-to-js';

export class MailersendProvider extends EmailProviderClass {
  protected _mailersendSdk: MailerSend;

  constructor(mailersendSettings: MailersendConfig) {
    super(createTransport(mailersendSettings));
    this._mailersendSdk = new MailerSend({
      apiKey: mailersendSettings.auth.apiKey,
    });
  }

  listTemplates(): Promise<Template[]> {
    throw new Error('Method not implemented.');
  }

  getTemplateInfo(template_name: string): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  createTemplate(): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    throw new Error('Method not implemented.');
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new MailersendBuilder();
  }

  async getEmailStatus(messageId: string): Promise<Indexable> {
    const [error, response] = await to(
      this._mailersendSdk.email.message.single(messageId),
    );
    if (error) {
      throw new Error(error.message);
    }
    return response.body.data.emails[0].status;
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info.response.split(' ').pop();
  }
}
