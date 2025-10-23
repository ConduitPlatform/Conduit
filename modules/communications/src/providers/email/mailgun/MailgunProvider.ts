import { to } from 'await-to-js';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { Options } from 'nodemailer/lib/mailer/index.js';
import { initialize as initializeMailgun } from './mailgun.js';
import { MailgunConfig } from './mailgun.config.js';
import { MailgunMailBuilder } from './mailgunMailBuilder.js';
import mailgun, { Mailgun } from 'mailgun-js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import {
  CreateEmailTemplate,
  DeleteEmailTemplate,
  MailgunTemplate,
  Template,
  UpdateEmailTemplate,
} from '../interfaces/index.js';
import { EmailBuilderClass, EmailProviderClass } from '../models/index.js';
import { getHandleBarsValues } from '../utils/index.js';

export class MailgunProvider extends EmailProviderClass {
  protected _mailgunSdk: Mailgun;
  private domain: string;
  private apiKey: string;

  constructor(mailgunSettings: MailgunConfig) {
    super(createTransport(initializeMailgun(mailgunSettings)));
    this.domain = mailgunSettings.auth.domain;
    this.apiKey = mailgunSettings.auth.api_key;
    this._mailgunSdk = mailgun({
      apiKey: this.apiKey,
      domain: this.domain,
      host: mailgunSettings.host,
    });
  }

  async listTemplates(): Promise<Template[]> {
    const templates = await this._mailgunSdk.get(`/${this.domain}/templates`);
    const retList: Template[] = templates.items.map(
      async (element: Template) => await this.getTemplateInfo(element.name),
    );
    return Promise.all(retList);
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const response: MailgunTemplate = await this._mailgunSdk.get(
      `/${this.domain}/templates/${template_name}`,
      { active: 'yes' },
    );
    return {
      name: response.template.name,
      id: response.template.name,
      createdAt: response.template.createdAt,
      versions: [
        {
          name: response.template.version.tag,
          id: response.template.version.id,
          body: response.template.version.template,
          active: true,
          updatedAt: '',
          variables: Object.keys(getHandleBarsValues(response.template.version.template)),
        },
      ],
    };
  }

  async createTemplate(data: CreateEmailTemplate): Promise<Template> {
    const mailgun_input = {
      name: data.name,
      template: data.body,
      description: '',
      active: true,
      tag: data.versionName,
    };

    const [err, response] = await to(
      this._mailgunSdk.post(`/${this.domain}/templates`, mailgun_input),
    );
    if (err) {
      throw new Error(err.message);
    }
    return {
      name: response.template.name,
      createdAt: response.template.createdAt,
      id: response.template.name,
      versions: [
        {
          name: response.template.version.tag,
          id: response.template.version.id,
          active: true,
          updatedAt: response.template.version.createdAt,
          body: response.template.version.template,
          variables: Object.keys(getHandleBarsValues(mailgun_input.template)),
        },
      ],
    };
  }

  async updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    const [err, template] = await to(
      this._mailgunSdk.put(`/${this.domain}/templates/${data.id}/versions/initial`, {
        template: data.body,
        active: data.active,
      }),
    );

    if (err) {
      throw new Error(err.message);
    }

    return this.getTemplateInfo(template.template.name);
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    const [err, resp] = await to(
      this._mailgunSdk.delete(`/${this.domain}/templates/${id}`),
    );
    if (err) {
      throw new Error(err.message);
    }
    return {
      id: id,
      message: resp.message,
    };
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new MailgunMailBuilder();
  }

  async getEmailStatus(messageId: string): Promise<Indexable> {
    const response = await this._mailgunSdk.get(`/${this.domain}/events`, {
      'message-id': messageId,
      ascending: 'no',
      limit: 1,
    });
    return response.items[0];
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info?.messageId;
  }
}
