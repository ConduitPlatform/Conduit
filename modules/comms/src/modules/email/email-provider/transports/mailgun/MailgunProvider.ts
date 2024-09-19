import { createTransport, SentMessageInfo } from 'nodemailer';
import { Options } from 'nodemailer/lib/mailer';
import { CreateEmailTemplate } from '../../interfaces/CreateEmailTemplate.js';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { EmailProviderClass } from '../../models/EmailProviderClass.js';
import { getHandleBarsValues } from '../../utils/index.js';
import { initialize as initializeMailgun } from './mailgun.js';
import { MailgunConfig } from './mailgun.config.js';
import { MailgunMailBuilder } from './mailgunMailBuilder.js';
import { DeleteEmailTemplate } from '../../interfaces/DeleteEmailTemplate.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import Mailgun, { Interfaces } from 'mailgun.js';
import formData from 'form-data';
import { Template } from '../../interfaces/Template.js';
import { YesNo } from 'mailgun.js/Enums';

export class MailgunProvider extends EmailProviderClass {
  protected _mailgunSdk: Interfaces.IMailgunClient;
  private domain: string;
  private apiKey: string;

  constructor(mailgunSettings: MailgunConfig) {
    super(createTransport(initializeMailgun(mailgunSettings)));
    this.domain = mailgunSettings.auth.domain;
    this.apiKey = mailgunSettings.auth.api_key;
    this._mailgunSdk = new Mailgun.default(formData).client({
      username: 'api',
      key: this.apiKey,
      url: mailgunSettings.host,
    });
  }

  async listTemplates(): Promise<Template[]> {
    const templates = await this._mailgunSdk.domains.domainTemplates.list(this.domain);
    const retList: Promise<Template>[] = templates.items.map(element =>
      this.getTemplateInfo(element.name),
    );
    return Promise.all(retList);
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const response: Interfaces.IDomainTemplate =
      await this._mailgunSdk.domains.domainTemplates.get(this.domain, template_name, {
        active: YesNo.YES,
      });
    return {
      name: response.name,
      id: response.name,
      createdAt: response.createdAt.toString(),
      versions: response.version
        ? [
            {
              name: response.version.tag,
              id: response.version.id,
              body: response.version.template,
              active: true,
              updatedAt: '',
              variables: Object.keys(getHandleBarsValues(response.version.template)),
            },
          ]
        : [],
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
    const response = await this._mailgunSdk.domains.domainTemplates.create(
      this.domain,
      mailgun_input,
    );

    return {
      name: response.name,
      createdAt: response.createdAt.toString(),
      id: response.name,
      versions: response.version
        ? [
            {
              name: response.version.tag,
              id: response.version.id,
              active: true,
              updatedAt: response.version.createdAt.toString(),
              body: response.version.template,
              variables: Object.keys(getHandleBarsValues(mailgun_input.template)),
            },
          ]
        : [],
    };
  }

  async updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    const template = await this._mailgunSdk.domains.domainTemplates.updateVersion(
      this.domain,
      data.id,
      data!.versionId!,
      {
        template: data.body,
        active: data.active as unknown as YesNo,
      },
    );

    return this.getTemplateInfo(template.templateName);
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    const res = await this._mailgunSdk.domains.domainTemplates.destroy(this.domain, id);
    return {
      id: id,
      message: res.message,
    };
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new MailgunMailBuilder();
  }

  async getEmailStatus(messageId: string): Promise<Indexable> {
    const response = await this._mailgunSdk.events.get(this.domain, {
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
