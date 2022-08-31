import { createTransport } from 'nodemailer';
import { EmailProviderClass } from '../../models/EmailProviderClass';
import { MandrillConfig } from './mandrill.config';
import { Mandrill } from 'mandrill-api';
import { Template } from '../../interfaces/Template';
import { CreateEmailTemplate } from '../../interfaces/CreateEmailTemplate';
import { MandrillBuilder } from './mandrillBuilder';
import { getHandleBarsValues } from '../../utils';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate';
import { MandrillTemplate } from '../../interfaces/mandrill/MandrillTemplate';

const mandrillTransport = require('nodemailer-mandrill-transport');

export class MandrillProvider extends EmailProviderClass {
  private _mandrillSdk?: Mandrill;
  private apiKey: string;

  constructor(mandrillSettings: MandrillConfig) {
    super(createTransport(mandrillTransport(mandrillSettings)));
    this._mandrillSdk = new Mandrill(mandrillSettings.auth.apiKey);
    this.apiKey = mandrillSettings.auth.apiKey;
  }

  async listTemplates(): Promise<Template[]> {
    const response: MandrillTemplate[] = await new Promise<any>(resolve =>
      this._mandrillSdk?.templates.list({ key: this.apiKey }, resolve),
    );
    const retList = response.map(
      async (element: any) => await this.getTemplateInfo(element.slug),
    );
    return Promise.all(retList);
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const response: MandrillTemplate = await new Promise<any>(resolve =>
      this._mandrillSdk?.templates.info(
        {
          key: this.apiKey,
          name: template_name,
        },
        resolve,
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
    const response = await new Promise<any>(resolve =>
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
    const response = await new Promise<any>(resolve =>
      this._mandrillSdk?.templates.update(
        {
          key: this.apiKey,
          name: data.id,
          code: data.body,
          subject: data.subject,
        },
        resolve,
      ),
    );

    return this.getTemplateInfo(response.slug);
  }

  async deleteTemplate(id: string) {
    const response = await new Promise<any>(resolve =>
      this._mandrillSdk?.templates.delete(
        {
          key: this.apiKey,
          name: id,
        },
        resolve,
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
}
