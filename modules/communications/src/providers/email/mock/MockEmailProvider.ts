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
  if (to == null || to === '') return '';
  if (typeof to === 'string') return to;
  if (Array.isArray(to)) {
    return to
      .map(recipient => formatRecipients(recipient))
      .filter(recipient => recipient.length > 0)
      .join(', ');
  }
  if (typeof to.address === 'string' && to.address.length > 0) return to.address;
  if (to.group) return formatRecipients(to.group);
  return '';
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
    const from = formatRecipients(mailOptions.from);
    const to = formatRecipients(mailOptions.to)
      .split(', ')
      .filter(address => address.length > 0);
    return Promise.resolve({
      messageId,
      response: 'OK (mock)',
      envelope: {
        from: from || false,
        to,
      },
    });
  }

  listTemplates(): Promise<Template[]> {
    return Promise.resolve([]);
  }

  getTemplateInfo(templateName: string): Promise<Template> {
    return Promise.reject(
      new Error(`${EXTERNAL_TEMPLATES_UNSUPPORTED}: ${templateName}`),
    );
  }

  createTemplate(data: CreateEmailTemplate): Promise<Template> {
    return Promise.reject(new Error(`${EXTERNAL_TEMPLATES_UNSUPPORTED}: ${data.name}`));
  }

  getBuilder(): EmailBuilderClass<Options> {
    return new NodemailerBuilder();
  }

  updateTemplate(data: UpdateEmailTemplate): Promise<Template> {
    return Promise.reject(new Error(`${EXTERNAL_TEMPLATES_UNSUPPORTED}: ${data.id}`));
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
