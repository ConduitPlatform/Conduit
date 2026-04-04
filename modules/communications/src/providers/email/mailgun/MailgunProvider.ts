import { to } from 'await-to-js';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { Options } from 'nodemailer/lib/mailer/index.js';
import { initialize as initializeMailgun } from './mailgun.js';
import { MailgunConfig } from './mailgun.config.js';
import { MailgunMailBuilder } from './mailgunMailBuilder.js';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { Enums } from 'mailgun.js/definitions';

type MailgunClient = ReturnType<InstanceType<typeof Mailgun>['client']>;
type MailgunClientOptions = Parameters<InstanceType<typeof Mailgun>['client']>[0];

type DomainTemplateListItem = Awaited<
  ReturnType<MailgunClient['domains']['domainTemplates']['list']>
>['items'][number];
import { Indexable } from '@conduitplatform/grpc-sdk';
import {
  CreateEmailTemplate,
  DeleteEmailTemplate,
  Template,
  UpdateEmailTemplate,
} from '../interfaces/index.js';
import { EmailBuilderClass, EmailProviderClass } from '../models/index.js';
import { getHandleBarsValues } from '../utils/index.js';

export class MailgunProvider extends EmailProviderClass {
  protected _mg: MailgunClient;
  private domain: string;
  private apiKey: string;

  constructor(mailgunSettings: MailgunConfig) {
    super(createTransport(initializeMailgun(mailgunSettings)));
    this.domain = mailgunSettings.auth.domain;
    this.apiKey = mailgunSettings.auth.api_key;

    const mailgunSdk = new Mailgun(FormData);
    const clientOpts: MailgunClientOptions = {
      username: 'api',
      key: this.apiKey,
    };
    if (mailgunSettings.host) {
      clientOpts.url = mailgunSettings.host.startsWith('http')
        ? mailgunSettings.host
        : `https://${mailgunSettings.host}`;
    }
    if (mailgunSettings.proxy) {
      try {
        const u = new URL(mailgunSettings.proxy);
        clientOpts.proxy = {
          host: u.hostname,
          port: Number(u.port || (u.protocol === 'https:' ? '443' : '80')),
          protocol: u.protocol.replace(':', ''),
          ...(u.username || u.password
            ? {
                auth: {
                  username: decodeURIComponent(u.username),
                  password: decodeURIComponent(u.password),
                },
              }
            : {}),
        };
      } catch {
        // ignore invalid proxy URL
      }
    }
    this._mg = mailgunSdk.client(clientOpts);
  }

  private mapDomainTemplate(t: DomainTemplateListItem): Template {
    const v = t.version;
    if (!v) {
      return {
        name: t.name,
        id: t.name,
        createdAt: String(t.createdAt),
        versions: [],
      };
    }
    return {
      name: t.name,
      id: t.name,
      createdAt: String(t.createdAt),
      versions: [
        {
          name: v.tag,
          id: v.id,
          body: v.template,
          active: v.active,
          updatedAt: String(v.createdAt ?? ''),
          variables: Object.keys(getHandleBarsValues(v.template)),
        },
      ],
    };
  }

  async listTemplates(): Promise<Template[]> {
    const { items } = await this._mg.domains.domainTemplates.list(this.domain);
    const retList = items.map(
      async (element: DomainTemplateListItem) => await this.getTemplateInfo(element.name),
    );
    return Promise.all(retList);
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const t = await this._mg.domains.domainTemplates.get(this.domain, template_name, {
      active: Enums.YesNo.YES,
    });
    return this.mapDomainTemplate(t);
  }

  async createTemplate(data: CreateEmailTemplate): Promise<Template> {
    const mailgun_input = {
      name: data.name,
      template: data.body,
      description: '',
      tag: data.versionName,
      engine: 'handlebars' as const,
    };

    const [err, created] = await to(
      this._mg.domains.domainTemplates.create(this.domain, mailgun_input),
    );
    if (err) {
      throw new Error(err.message);
    }
    const mapped = this.mapDomainTemplate(created);
    if (mapped.versions[0]) {
      mapped.versions[0].variables = Object.keys(
        getHandleBarsValues(mailgun_input.template),
      );
    }
    return mapped;
  }

  async updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    const [err, result] = await to(
      this._mg.domains.domainTemplates.updateVersion(this.domain, data.id, 'initial', {
        template: data.body,
        active: data.active ? Enums.YesNo.YES : Enums.YesNo.NO,
      }),
    );

    if (err) {
      throw new Error(err.message);
    }

    return this.getTemplateInfo(result.templateName ?? data.id);
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    const [err, resp] = await to(
      this._mg.domains.domainTemplates.destroy(this.domain, id),
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
    const { items } = await this._mg.events.get(this.domain, {
      'message-id': messageId,
      ascending: 'no',
      limit: 1,
    });
    return items[0] as Indexable;
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info?.messageId;
  }
}
