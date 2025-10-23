import { createTransport, SentMessageInfo } from 'nodemailer';
import { AmazonSesConfig } from './amazonSes.config.js';
import { Options } from 'nodemailer/lib/mailer/index.js';
import { AmazonSesBuilder } from './amazonSesBuilder.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { to } from 'await-to-js';
import SESTransport from 'nodemailer/lib/ses-transport/index.js';
import {
  CreateEmailTemplateCommand,
  DeleteEmailTemplateCommand,
  GetEmailTemplateCommand,
  ListEmailTemplatesCommand,
  SendEmailCommand,
  SESv2Client,
  UpdateEmailTemplateCommand,
} from '@aws-sdk/client-sesv2';
import { getHandleBarsValues } from '../utils/index.js';
import {
  AmazonSesEmailOptions,
  CreateEmailTemplate,
  DeleteEmailTemplate,
  Template,
  UpdateEmailTemplate,
} from '../interfaces/index.js';
import { EmailBuilderClass, EmailProviderClass } from '../models/index.js';

export class AmazonSesProvider extends EmailProviderClass {
  protected _amazonsSesSdk: SESv2Client;

  constructor(amazonSesSettings: AmazonSesConfig) {
    const { region, accessKeyId, secretAccessKey } = amazonSesSettings;
    const sesClient = new SESv2Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    super(
      createTransport(
        //@ts-expect-error type mismatch between mailer and ses
        new SESTransport({ SES: { sesClient, SendEmailCommand: SendEmailCommand } }),
      ),
    );
    this._amazonsSesSdk = sesClient;
  }

  async listTemplates(): Promise<Template[]> {
    const [err, response] = await to(
      this._amazonsSesSdk.send(new ListEmailTemplatesCommand({})),
    );
    if (err) {
      throw new Error(err.message);
    }
    if (!response.TemplatesMetadata || response.TemplatesMetadata.length === 0) {
      return [];
    }
    const templates: Template[] = [];
    for (const templateMetadata of response.TemplatesMetadata) {
      if (!templateMetadata.TemplateName) continue;
      const templateInfo = await this.getTemplateInfo(templateMetadata.TemplateName);
      templates.push(templateInfo);
    }
    return templates;
  }

  async getTemplateInfo(template_name: string): Promise<Template> {
    const [err, response] = await to(
      this._amazonsSesSdk.send(
        new GetEmailTemplateCommand({ TemplateName: template_name }),
      ),
    );
    if (err) {
      throw new Error(err.message);
    }
    const templateInfo = response.TemplateContent;
    if (!templateInfo) {
      throw new Error('Response does not contain template information.');
    }
    const { Html, Subject, Text } = templateInfo;
    const name = response.TemplateName;
    if (!name || !Html || !Subject || !Text) {
      throw new Error('Response does not contain all template information.');
    }
    const date = new Date(Number(name.split('_').pop())).toISOString();
    const textVars = Object.keys(getHandleBarsValues(Text));
    const subjectVars = Object.keys(getHandleBarsValues(Subject));
    return {
      name,
      id: name,
      createdAt: date,
      versions: [
        {
          name,
          id: name,
          subject: Subject,
          body: Text,
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
        new CreateEmailTemplateCommand({
          TemplateName: `${data.name}_${timestamp}`,
          TemplateContent: {
            Subject: data.subject,
            Text: data.body,
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
        new UpdateEmailTemplateCommand({
          TemplateName: data.id,
          TemplateContent: {
            Subject: data.subject,
            Text: data.body,
          },
        }),
      ),
    );
    if (err) throw new Error(err.message);
    return await this.getTemplateInfo(data.id);
  }

  async deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    const [err] = await to(
      this._amazonsSesSdk.send(new DeleteEmailTemplateCommand({ TemplateName: id })),
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
      const command = new SendEmailCommand({
        FromEmailAddress: mailOptions.from as string,
        Destination: { ToAddresses: [mailOptions.to as string] },
        Content: {
          Template: {
            TemplateName: mailOptions.template!,
            TemplateData: mailOptions.templateData!,
          },
        },
      });

      return this._amazonsSesSdk.send(command);
    } else {
      return this._transport?.sendMail(mailOptions);
    }
  }
}
