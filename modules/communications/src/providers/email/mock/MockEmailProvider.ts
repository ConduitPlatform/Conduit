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

const EXTERNAL_TEMPLATES_UNSUPPORTED =
  'Mock provider does not support external templates';

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

export class MockEmailProvider extends EmailProviderClass {
  constructor() {
    super(createTransport({ jsonTransport: true }));
  }

  sendEmail(mailOptions: Mail.Options): Promise<SentMessageInfo> {
    const messageId = `mock-${randomUUID()}`;
    ConduitGrpcSdk.Logger.log(
      `[MOCK EMAIL] To: ${formatRecipients(mailOptions.to)} | Subject: ${mailOptions.subject ?? ''}`,
    );
    return Promise.resolve({
      messageId,
      response: 'OK (mock)',
    });
  }

  listTemplates(): Promise<Template[]> {
    return Promise.resolve([]);
  }

  getTemplateInfo(_templateName: string): Promise<Template> {
    return Promise.reject(new Error(EXTERNAL_TEMPLATES_UNSUPPORTED));
  }

  createTemplate(_data: CreateEmailTemplate): Promise<Template> {
    return Promise.reject(new Error(EXTERNAL_TEMPLATES_UNSUPPORTED));
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new NodemailerBuilder();
  }

  updateTemplate(_data: UpdateEmailTemplate): Promise<Template> {
    return Promise.reject(new Error(EXTERNAL_TEMPLATES_UNSUPPORTED));
  }

  deleteTemplate(id: string): Promise<DeleteEmailTemplate> {
    return Promise.resolve({ id, message: 'OK (mock)' });
  }

  getEmailStatus(messageId: string): Promise<Indexable> {
    return Promise.resolve({ status: 'delivered', messageId });
  }

  getMessageId(info: SentMessageInfo): string | undefined {
    return info.messageId;
  }
}
