import { EmailProviderClass } from '../../models/EmailProviderClass.js';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { Template } from '../../interfaces/Template.js';
import { AmazonSesConfig } from './amazonSes.config.js';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate.js';
import { DeleteEmailTemplate } from '../../interfaces/DeleteEmailTemplate.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { Options } from 'nodemailer/lib/mailer';
import { AmazonSesBuilder } from './amazonSesBuilder.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import * as aws from '@aws-sdk/client-ses';
import { CreateEmailTemplate } from '../../interfaces/CreateEmailTemplate.js';
import { to } from 'await-to-js';
import { getHandleBarsValues } from '../../utils/index.js';
import {
  CreateTemplateCommand,
  DeleteTemplateCommand,
  GetTemplateCommand,
  ListTemplatesCommand,
  SendTemplatedEmailCommand,
  UpdateTemplateCommand,
} from '@aws-sdk/client-ses';
import { AmazonSesEmailOptions } from '../../interfaces/amazonSes/AmazonSesEmailOptions.js';

export class AmazonSesProvider extends EmailProviderClass {
  protected _amazonsSesSdk: aws.SESClient;

  constructor(amazonSesSettings: AmazonSesConfig) {
    const ses = new aws.SES({
      apiVersion: '2010-12-01',
      region: 'eu-north-1',
      credentials: {
        accessKeyId: amazonSesSettings.accessKeyId,
        secretAccessKey: amazonSesSettings.secretAccessKey,
      },
    });
    super(createTransport({ SES: { ses, aws } }));
    this._amazonsSesSdk = ses;
  }

  async listTemplates(): Promise<Template[]> {
    const [err, response] = await to(
      this._amazonsSesSdk.send(new ListTemplatesCommand({})),
    );
    if (err) {
      throw new Error(err.message);
    }
    if (!response.TemplatesMetadata || response.TemplatesMetadata.length === 0) {
      return [];
    }
    const templates: Template[] = [];
    for (const templateMetadata of response.TemplatesMetadata) {
      if (!templateMetadata.Name) continue;
      const templateInfo = await this.getTemplateInfo(templateMetadata.Name);
      templates.push(templateInfo);
    }
    return templates;
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const [err, response] = await to(
      this._amazonsSesSdk.send(new GetTemplateCommand({ TemplateName: template_name })),
    );
    if (err) {
      throw new Error(err.message);
    }
    const templateInfo = response.Template;
    if (!templateInfo) {
      throw new Error('Response does not contain template information.');
    }
    const { TemplateName, SubjectPart, TextPart } = templateInfo;
    if (!TemplateName || !SubjectPart || !TextPart) {
      throw new Error('Response does not contain template information.');
    }
    const date = new Date(Number(TemplateName.split('_').pop())).toISOString();
    const textVars = Object.keys(getHandleBarsValues(TextPart));
    const subjectVars = Object.keys(getHandleBarsValues(SubjectPart));
    return {
      name: TemplateName,
      id: TemplateName,
      createdAt: date,
      versions: [
        {
          name: TemplateName,
          id: TemplateName,
          subject: SubjectPart,
          body: TextPart,
          active: true,
          updatedAt: date,
          variables: Array.from(new Set([...textVars, ...subjectVars])),
        },
      ],
    };
  }

  async createTemplate(data: CreateEmailTemplate): Promise<Template> {
    const timestamp = Date.now();
    const [err] = await to(
      this._amazonsSesSdk.send(
        new CreateTemplateCommand({
          Template: {
            TemplateName: `${data.name}_${timestamp}`,
            SubjectPart: data.subject,
            TextPart: data.body,
          },
        }),
      ),
    );
    if (err) throw new Error(err.message);
    return await this.getTemplateInfo(`${data.name}_${timestamp}`);
  }

  async updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    const [err, _] = await to(
      this._amazonsSesSdk.send(
        new UpdateTemplateCommand({
          Template: {
            TemplateName: data.id,
            SubjectPart: data.subject,
            TextPart: data.body,
          },
        }),
      ),
    );
    if (err) throw new Error(err.message);
    return await this.getTemplateInfo(data.id);
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    const [err] = await to(
      this._amazonsSesSdk.send(new DeleteTemplateCommand({ TemplateName: id })),
    );
    if (err) {
      throw new Error(err.message);
    }
    return { id, message: 'Template deleted successfully' };
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new AmazonSesBuilder();
  }

  async getEmailStatus(messageId: string): Promise<Indexable> {
    // Amazon SES does not provide a direct way to view the status of an email that was sent.
    // One way to achieve this would be to connect SES with SNS and receive events via a webhook.
    return { status: 'unknown' };
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info.messageId;
  }

  sendEmail(mailOptions: AmazonSesEmailOptions) {
    if (mailOptions.template && mailOptions.templateData) {
      // @ts-expect-error Temporarily ignore TS errors
      const command = new SendTemplatedEmailCommand({
        Source: mailOptions.from,
        Destination: { ToAddresses: [mailOptions.to] },
        Template: mailOptions.template,
        TemplateData: mailOptions.templateData,
      });

      return this._amazonsSesSdk.send(command);
    } else {
      return this._transport?.sendMail(mailOptions);
    }
  }
}
