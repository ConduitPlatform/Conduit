import { EmailProviderClass } from '../../models/EmailProviderClass.js';
import { MailersendConfig } from './mailersend.config.js';
import { createTransport, SentMessageInfo } from 'nodemailer';
import { EmailParams, MailerSend, Recipient, Sender } from 'mailersend';
import { Template } from '../../interfaces/Template.js';
import { EmailBuilderClass } from '../../models/EmailBuilderClass.js';
import { Options } from 'nodemailer/lib/mailer/index.js';
import { UpdateEmailTemplate } from '../../interfaces/UpdateEmailTemplate.js';
import { DeleteEmailTemplate } from '../../interfaces/DeleteEmailTemplate.js';
import { Indexable } from '@conduitplatform/grpc-sdk';
import { MailersendBuilder } from './mailersendBuilder.js';
import { to } from 'await-to-js';
import Mail from 'nodemailer/lib/mailer';

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
    return response.body.data.emails[0].status;
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info.headers['x-message-id'];
  }

  async sendEmail(mailOptions: Mail.Options) {
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

    return await this._mailersendSdk.email.send(emailParams);
  }
}
