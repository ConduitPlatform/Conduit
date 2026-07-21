import { randomUUID } from 'crypto';
import { createTransport, SentMessageInfo } from 'nodemailer';
import Mail, { Options } from 'nodemailer/lib/mailer/index.js';
import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import {
  CreateEmailTemplate,
  DeleteEmailTemplate,
  Template,
  UpdateEmailTemplate,
} from '../interfaces/index.js';
import { EmailBuilderClass, EmailProviderClass } from '../models/index.js';
import { NodemailerBuilder } from '../nodemailer/nodemailerBuilder.js';

function formatRecipients(to: Mail.Options['to']): string {
  if (!to) return '';
  if (typeof to === 'string') return to;
  if (Array.isArray(to)) {
    return to
      .map(recipient => (typeof recipient === 'string' ? recipient : recipient.address))
      .join(', ');
  }
  return to.address;
}

function formatBodySnippet(mailOptions: Mail.Options): string {
  const content = mailOptions.html ?? mailOptions.text ?? '';
  const text = typeof content === 'string' ? content : '';
  return text.length > 100 ? `${text.slice(0, 100)}...` : text;
}

export class MockEmailProvider extends EmailProviderClass {
  constructor() {
    super(createTransport({ jsonTransport: true }));
  }

  sendEmail(mailOptions: Mail.Options): Promise<SentMessageInfo> {
    const messageId = `mock-${randomUUID()}`;
    ConduitGrpcSdk.Logger.log(
      `[MOCK EMAIL] To: ${formatRecipients(mailOptions.to)} | Subject: ${mailOptions.subject ?? ''} | Body: ${formatBodySnippet(mailOptions)}`,
    );
    return Promise.resolve({
      messageId,
      response: 'OK (mock)',
    });
  }

  listTemplates(): Promise<Template[]> {
    throw new Error('Method not implemented.');
  }

  getTemplateInfo(_templateName: string): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  createTemplate(_data: CreateEmailTemplate): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new NodemailerBuilder();
  }

  updateTemplate(_data: UpdateEmailTemplate): Promise<Template> {
    throw new Error('Method not implemented.');
  }

  deleteTemplate(_id: string): Promise<DeleteEmailTemplate> {
    throw new Error('Method not implemented.');
  }

  getEmailStatus(messageId: string): Promise<Indexable> {
    return Promise.resolve({ status: 'delivered', messageId });
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info.messageId;
  }
}
