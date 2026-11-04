import { MailersendConfig } from './mailersend.config.js';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';
import Mail, { Options } from 'nodemailer/lib/mailer/index.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { MailersendBuilder } from './mailersendBuilder.js';
import { to } from 'await-to-js';
import {
  DeleteEmailTemplate,
  Template,
  UpdateEmailTemplate,
} from '../interfaces/index.js';
import { EmailBuilderClass, EmailProviderClass } from '../models/index.js';

export class MailersendProvider extends EmailProviderClass {
  protected _mailersendSdk: MailerSend;

  constructor(mailersendSettings: MailersendConfig) {
    super(createTransport(mailersendSettings));
    this._mailersendSdk = new MailerSend({
      apiKey: mailersendSettings.apiKey,
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
    return response.body.data.emails[0];
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info.headers['x-message-id'];
  }

  async sendEmail(mailOptions: Mail.Options): Promise<SentMessageInfo> {
    const emailParams = new EmailParams()
      .setFrom(new Sender(mailOptions.from as string))
      .setTo([new Recipient(mailOptions.to as string)])
      .setSubject(mailOptions.subject as string);

    if (mailOptions.html) emailParams.setHtml(mailOptions.html as string);
    if (mailOptions.text) emailParams.setText(mailOptions.text as string);
    if (mailOptions.replyTo)
      emailParams.setReplyTo(new Recipient(mailOptions.replyTo as string));
    if (mailOptions.cc) {
      emailParams.setCc(
        (mailOptions.cc as string[]).map(ccRecipient => new Recipient(ccRecipient)),
      );
    }

    const response = await this._mailersendSdk.email.send(emailParams);
    const rawId = response.headers?.['x-message-id'];
    const messageId =
      typeof rawId === 'string'
        ? rawId
        : Array.isArray(rawId)
          ? String(rawId[0] ?? '')
          : '';
    const from = typeof mailOptions.from === 'string' ? mailOptions.from : '';
    const to = typeof mailOptions.to === 'string' ? mailOptions.to : '';
    return {
      messageId,
      response: String(response.statusCode),
      headers: response.headers,
      body: response.body,
      statusCode: response.statusCode,
      envelope: {
        from: from.length > 0 ? from : false,
        to: to.length > 0 ? [to] : [],
      },
    };
  }
}
