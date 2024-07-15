import { createTransport, SentMessageInfo } from 'nodemailer';
import { EmailProviderClass } from '../../models/EmailProviderClass.js';
import { MandrillConfig } from './mandrill.config.js';
import { Mandrill } from 'mandrill-api';
import { Template } from '../../interfaces/Template.js';
import { CreateEmailTemplate } from '../../interfaces/CreateEmailTemplate.js';
import { MandrillBuilder } from './mandrillBuilder.js';
import { getHandleBarsValues } from '../../utils/index.js';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate.js';
import { MandrillTemplate } from '../../interfaces/mandrill/MandrillTemplate.js';

// @ts-expect-error
// missing typings for nodemailer-mandrill-transport
import mandrillTransport from 'nodemailer-mandrill-transport';
import { Indexable } from '@conduitplatform/grpc-sdk';

export class MandrillProvider extends EmailProviderClass {
  private _mandrillSdk?: Mandrill;
  private apiKey: string;

  constructor(mandrillSettings: MandrillConfig) {
    super(createTransport(mandrillTransport(mandrillSettings)));
    this._mandrillSdk = new Mandrill(mandrillSettings.auth.apiKey);
    this.apiKey = mandrillSettings.auth.apiKey;
  }

  async listTemplates(): Promise<Template[]> {
    const response: MandrillTemplate[] = await new Promise<any>(
      resolve => this._mandrillSdk?.templates.list({ key: this.apiKey }, resolve),
    );
    const retList = response.map(
      async element => await this.getTemplateInfo(element.slug),
    );
    return Promise.all(retList);
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const response: MandrillTemplate = await new Promise<MandrillTemplate>(
      resolve =>
        this._mandrillSdk?.templates.info(
          {
            key: this.apiKey,
            name: template_name,
          },
          resolve as (json: object) => void,
        ),
    );
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
    const response = await new Promise<any>(
      resolve =>
        this._mandrillSdk?.templates.add(
          {
            key: this.apiKey,
            subject: data.subject,
            code: data.body,
            publish: true,
            name: data.name,
          },
          resolve,
        ),
    );
    const created = await this.getTemplateInfo(response.slug);
    created.versions[0].variables = Object.keys(getHandleBarsValues(data.body));
    return created;
  }

  async updateTemplate(data: UpdateEmailTemplate) {
    const response = await new Promise<{ slug: string }>(
      resolve =>
        this._mandrillSdk?.templates.update(
          {
            key: this.apiKey,
            name: data.id,
            code: data.body,
            subject: data.subject,
          },
          resolve as (json: object) => void,
        ),
    );

    return this.getTemplateInfo(response.slug);
  }

  async deleteTemplate(id: string) {
    const response = await new Promise<{ slug: string }>(
      resolve =>
        this._mandrillSdk?.templates.delete(
          {
            key: this.apiKey,
            name: id,
          },
          resolve as (json: object) => void,
        ),
    );

    return {
      message: 'Template ' + response.slug + ' deleted!',
      id: id,
    };
  }

  getBuilder() {
    return new MandrillBuilder();
  }

  async getEmailStatus(messageId: string): Promise<Indexable> {
    return new Promise<Indexable>(
      resolve =>
        this._mandrillSdk?.messages.info(
          {
            id: messageId,
          },
          resolve as (json: object) => void,
        ),
    );
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info?.messageId;
  }
}
