import { createTransport, SentMessageInfo } from 'nodemailer';
import { EmailProviderClass } from '../models/EmailProviderClass.js';
import { MandrillConfig } from './mandrill.config.js';
import { Template } from '../interfaces/Template.js';
import { CreateEmailTemplate, UpdateEmailTemplate } from '../interfaces/index.js';
import { MandrillBuilder } from './mandrillBuilder.js';
import { getHandleBarsValues } from '../utils/index.js';
import { MandrillTemplate } from '../interfaces/mandrill/MandrillTemplate.js';

// @ts-expect-error — CJS package without bundled types
import mailchimpFactory from '@mailchimp/mailchimp_transactional';

// @ts-expect-error
// missing typings for nodemailer-mandrill-transport
import mandrillTransport from 'nodemailer-mandrill-transport';
import { Indexable } from '@conduitplatform/grpc-sdk';

type MailchimpTransactional = ReturnType<typeof mailchimpFactory>;

export class MandrillProvider extends EmailProviderClass {
  private _mailchimp: MailchimpTransactional;

  constructor(mandrillSettings: MandrillConfig) {
    super(createTransport(mandrillTransport(mandrillSettings)));
    this._mailchimp = mailchimpFactory(mandrillSettings.auth.apiKey);
  }

  async listTemplates(): Promise<Template[]> {
    const response: MandrillTemplate[] = await this._mailchimp.templates.list({});
    const retList = response.map(
      async element => await this.getTemplateInfo(element.slug),
    );
    return Promise.all(retList);
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const response: MandrillTemplate = await this._mailchimp.templates.info({
      name: template_name,
    });
    return {
      id: response.slug,
      name: response.name,
      versions: [
        {
          name: response.name,
          id: response.slug,
          subject: response.subject,
          active: true,
          updatedAt: response.updated_at,
          body: response.code,
          variables: Object.keys(getHandleBarsValues(response.code)),
        },
      ],
      createdAt: response.created_at,
    };
  }

  async createTemplate(data: CreateEmailTemplate): Promise<Template> {
    const response: { slug: string } = await this._mailchimp.templates.add({
      name: data.name,
      subject: data.subject,
      code: data.body,
      publish: true,
    });
    const created = await this.getTemplateInfo(response.slug);
    created.versions[0].variables = Object.keys(getHandleBarsValues(data.body));
    return created;
  }

  async updateTemplate(data: UpdateEmailTemplate) {
    const response: { slug: string } = await this._mailchimp.templates.update({
      name: data.id,
      code: data.body,
      subject: data.subject,
    });

    return this.getTemplateInfo(response.slug);
  }

  async deleteTemplate(id: string) {
    await this._mailchimp.templates.delete({
      name: id,
    });

    return {
      message: 'Template ' + id + ' deleted!',
      id: id,
    };
  }

  getBuilder() {
    return new MandrillBuilder();
  }

  async getEmailStatus(messageId: string): Promise<Indexable> {
    return (await this._mailchimp.messages.info({
      id: messageId,
    })) as Indexable;
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info?.messageId;
  }
}
