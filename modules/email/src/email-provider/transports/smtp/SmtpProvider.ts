import { createTransport } from 'nodemailer';
import { Options } from 'nodemailer/lib/mailer';
import { Template } from '../../interfaces/Template.js';
import { DeleteEmailTemplate } from '../../interfaces/DeleteEmailTemplate.js';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { EmailProviderClass } from '../../models/EmailProviderClass.js';
import { NodemailerBuilder } from '../nodemailer/nodemailerBuilder.js';
import { Indexable } from '@conduitplatform/grpc-sdk';

export class SmtpProvider extends EmailProviderClass {
  constructor(transportSettings: any) {
    super(createTransport(transportSettings));
    this._transport!.verify((error, success) => {
      console.log(!success ? error : 'SMTP connection established');
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

  getBuilder(): EmailBuilderClass<Options> {
    return new NodemailerBuilder();
  }

  updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    throw new Error('Method not implemented.');
  }

  getEmailStatus(messageId: string): Promise<Indexable> {
    throw new Error('Method not implemented.');
  }
}
