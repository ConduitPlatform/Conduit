import { isEmpty, isNil } from 'lodash-es';
import { EmailRecord, EmailTemplate } from '../models/index.js';
import handlebars from 'handlebars';
import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  ChannelResult,
  ChannelStatus,
  IChannel,
  IChannelSendParams,
} from '../interfaces/index.js';
import { EmailProvider } from '../providers/email/index.js';
import { CreateEmailTemplate } from '../providers/email/interfaces/CreateEmailTemplate.js';
import { Attachment } from 'nodemailer/lib/mailer/index.js';
import { Template } from '../providers/email/interfaces/Template.js';
import { getHandleBarsValues } from '../providers/email/utils/index.js';
import { QueueController } from '../controllers/queue.controller.js';
import { storeEmail } from '../utils/storeEmail.js';
import { Config } from '../config/index.js';
import { channelFailure, Provider } from '../utils/index.js';

const STATUS_UNSUPPORTED_TRANSPORTS = new Set(['amazonSes', 'smtp', 'mock']);

export interface IRegisterTemplateParams {
  name: string;
  subject: string;
  body: string;
  variables: string[];
  sender?: string;
  jsonTemplate?: string;
}

export interface IUpdateTemplateParams {
  name?: string;
  subject?: string;
  body?: string;
  variables?: string[];
  sender?: string;
}

export interface ISendEmailParams {
  email: string;
  body?: string;
  subject?: string;
  variables?: Record<string, any>;
  sender?: string;
  cc?: string[];
  replyTo?: string;
  attachments?: Attachment[];
}

export class EmailService implements IChannel {
  private emailer?: EmailProvider;
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public async initEmailProvider(config: Config) {
    const emailConfig = config.email;

    if (!emailConfig || !emailConfig.transport || !emailConfig.transportSettings) {
      ConduitGrpcSdk.Logger.warn('Email not configured');
    }
    if (!emailConfig.active) {
      this.emailer = undefined;
      return;
    }

    const { transport, transportSettings } = emailConfig;
    try {
      this.emailer = new EmailProvider(transport, transportSettings);
    } catch (e) {
      this.emailer = undefined;
      ConduitGrpcSdk.Logger.error('Failed to initialize Email provider:', e);
    }
  }

  isAvailable(): boolean {
    return !!this.emailer;
  }

  async send(params: IChannelSendParams): Promise<ChannelResult> {
    try {
      const { recipient, subject, body, variables, sender, cc, replyTo, attachments } =
        params;

      const emailParams: ISendEmailParams = {
        email: recipient,
        body,
        subject,
        variables,
        sender,
        cc,
        replyTo,
        attachments: attachments?.map(a => ({ path: a })),
      };

      const result = await this.sendEmail(undefined, emailParams);

      return {
        success: true,
        messageId: result.messageId,
        channel: 'email',
      };
    } catch (error) {
      return {
        success: false,
        ...channelFailure(error, errors.EMAIL_PROVIDER_ERROR),
        channel: 'email',
      };
    }
  }

  async sendMany(params: IChannelSendParams[]): Promise<ChannelResult[]> {
    const results: ChannelResult[] = [];

    for (const param of params) {
      const result = await this.send(param);
      results.push(result);
    }

    return results;
  }

  async getStatus(messageId: string): Promise<ChannelStatus> {
    try {
      const statusInfo = await this.getEmailStatus(messageId);
      return {
        status: (statusInfo.status || 'unknown') as
          'pending' | 'sent' | 'delivered' | 'failed' | 'bounced',
        messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        messageId,
        ...channelFailure(error, errors.EMAIL_PROVIDER_ERROR),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Runs a transport call: typed errors (unsupported operation, ...) pass through,
   * anything else becomes EMAIL_PROVIDER_ERROR with the provider text kept for the log.
   */
  private async callTransport<T>(call: () => Promise<T> | T): Promise<T> {
    try {
      return await call();
    } catch (e) {
      throw ModuleError.from(e, errors.EMAIL_PROVIDER_ERROR);
    }
  }

  private callTransportSync<T>(call: () => T): T {
    try {
      return call();
    } catch (e) {
      throw ModuleError.from(e, errors.EMAIL_PROVIDER_ERROR);
    }
  }

  async getExternalTemplates() {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    return this.callTransport(() => this.emailer!._transport?.listTemplates());
  }

  async getExternalTemplate(id: string) {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    return this.callTransport(() => this.emailer!._transport?.getTemplateInfo(id));
  }

  async createExternalTemplate(data: CreateEmailTemplate): Promise<Template> {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    const created = await this.callTransport(() =>
      this.emailer!._transport?.createTemplate(data),
    );
    if (!created)
      throw new ModuleError(errors.EMAIL_NOT_CONFIGURED, 'Transport is not available');
    return created;
  }

  async deleteExternalTemplate(id: string) {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    return this.callTransport(() => this.emailer!._transport?.deleteTemplate(id));
  }

  async registerTemplate(params: IRegisterTemplateParams) {
    const { name, body, subject, variables, sender, jsonTemplate } = params;

    const existing = await EmailTemplate.getInstance()
      .findOne({ name })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    if (!isNil(existing)) return existing;

    return EmailTemplate.getInstance()
      .create({
        name,
        subject,
        body,
        sender,
        variables,
        jsonTemplate,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
  }

  async updateTemplate(id: string, params: IUpdateTemplateParams) {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    const templateDocument = await EmailTemplate.getInstance()
      .findOne({
        _id: id,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    if (isNil(templateDocument)) {
      throw new ModuleError(errors.TEMPLATE_NOT_FOUND);
    }

    ['name', 'subject', 'body', 'sender', 'jsonTemplate'].forEach(key => {
      if (params[key as keyof IUpdateTemplateParams]) {
        // @ts-ignore
        templateDocument[key] = params[key];
      }
    });

    templateDocument.variables = Object.keys(getHandleBarsValues(params.body)).concat(
      Object.keys(getHandleBarsValues(params.subject)),
    );
    if (templateDocument.variables) {
      templateDocument.variables = [...new Set(templateDocument.variables)];
    }

    const updatedTemplate = await EmailTemplate.getInstance()
      .findByIdAndUpdate(id, templateDocument)
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    if (templateDocument.externalManaged) {
      const template = await this.getExternalTemplate(updatedTemplate!.externalId!);
      let versionId = undefined;
      if (!isNil(template?.versions[0].id)) {
        versionId = template?.versions[0].id;
      }
      const data = {
        id: updatedTemplate!.externalId!,
        subject: updatedTemplate!.subject,
        body: updatedTemplate!.body,
        versionId: versionId,
      };
      await this.callTransport(() => this.emailer!._transport?.updateTemplate(data));
    }

    return { template: updatedTemplate };
  }

  async sendEmail(
    template: string | undefined,
    params: ISendEmailParams,
    contentFileId?: string,
  ) {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    const { email, body, subject, variables, sender } = params;
    const builder = this.callTransportSync(() => this.emailer!.emailBuilder());

    if (!template && (!body || !subject)) {
      throw new ModuleError(errors.EMAIL_CONTENT_REQUIRED);
    }
    let subjectString = subject!;
    let bodyString = body!;
    let templateFound: EmailTemplate | null = null;
    let senderAddress: string | undefined;
    if (template) {
      templateFound = await EmailTemplate.getInstance()
        .findOne({ name: template })
        .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
      if (isNil(templateFound)) {
        throw new ModuleError(
          errors.TEMPLATE_NOT_FOUND,
          `Template ${template} not found`,
        );
      }
      const found = templateFound;
      if (found.externalManaged) {
        this.callTransportSync(() =>
          builder.setTemplate({
            id: found.externalId!,
            variables: variables as Indexable,
          }),
        );
      } else {
        bodyString = this.callTransportSync(() =>
          handlebars.compile(found.body)(variables),
        );
      }
      if (!isNil(found.subject)) {
        subjectString = this.callTransportSync(() =>
          handlebars.compile(found.subject)(variables),
        );
      }
      if (!isEmpty(templateFound.sender)) {
        senderAddress = templateFound.sender;
      }
    }
    if (!isEmpty(sender)) {
      senderAddress = sender;
    }

    if (isNil(senderAddress) || isEmpty(senderAddress)) {
      if (!isEmpty(sender)) {
        senderAddress = sender;
      } else {
        senderAddress = 'no-reply';
      }
    }
    const config = ConfigController.getInstance().config;
    if (isNil(config.email?.sendingDomain) || isEmpty(config.email.sendingDomain)) {
      if (senderAddress!.includes('@')) {
        ConduitGrpcSdk.Logger.warn(
          `Sending domain is not set, attempting to send email with provided address: ${senderAddress}`,
        );
      } else {
        throw new ModuleError(
          errors.EMAIL_SENDING_DOMAIN_NOT_SET,
          `Sender address: ${senderAddress}`,
        );
      }
    } else if (senderAddress && !senderAddress.includes(config.email.sendingDomain)) {
      if (senderAddress.includes('@')) {
        ConduitGrpcSdk.Logger.warn(
          `You are trying to send email from ${senderAddress} but it does not match sending domain ${config.email.sendingDomain}`,
        );
      } else {
        senderAddress = `${senderAddress}@${config.email.sendingDomain}`;
      }
    }
    if (senderAddress) {
      builder.setSender(senderAddress);
    }
    builder.setContent(bodyString);
    builder.setReceiver(email);
    builder.setSubject(subjectString);
    if (params.cc) {
      builder.setCC(params.cc);
    }
    if (params.replyTo) {
      builder.setReplyTo(params.replyTo);
    }
    if (params.attachments) {
      builder.addAttachments(params.attachments as Attachment[]);
    }

    const sentMessageInfo = await this.callTransport(() =>
      this.emailer!.sendEmail(builder),
    );
    const messageId = this.emailer!._transport?.getMessageId(sentMessageInfo);

    if (config.email?.storeEmails?.enabled) {
      const emailRecId = await storeEmail(
        this.grpcSdk,
        messageId,
        templateFound,
        contentFileId,
        {
          body: bodyString,
          subject: subjectString,
          ...params,
        },
      ).catch(ModuleError.rethrow(errors.STORAGE_UNAVAILABLE));

      if (messageId) {
        const transport = config.email?.transport;
        if (transport && !STATUS_UNSUPPORTED_TRANSPORTS.has(transport)) {
          await QueueController.getInstance()
            .addEmailStatusJob(messageId, emailRecId, 0, transport as Provider)
            .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
        }
      }
    }
    return { messageId, ...sentMessageInfo };
  }

  async resendEmail(emailRecordId: string) {
    if (!this.grpcSdk.isAvailable('storage')) {
      throw new ModuleError(errors.STORAGE_UNAVAILABLE);
    }
    const emailRecord = await EmailRecord.getInstance()
      .findOne({ _id: emailRecordId })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    if (isNil(emailRecord)) {
      throw new ModuleError(errors.EMAIL_RECORD_NOT_FOUND);
    }
    const contentFileData = await this.grpcSdk
      .storage!.getFileData(emailRecord.contentFile)
      .catch(ModuleError.rethrow(errors.STORAGE_UNAVAILABLE));
    if (!contentFileData) {
      throw new ModuleError(errors.EMAIL_CONTENT_FILE_NOT_FOUND);
    }
    const dataString = Buffer.from(contentFileData.data, 'base64').toString('utf-8');
    let emailParams: ISendEmailParams;
    try {
      emailParams = JSON.parse(dataString);
    } catch (e) {
      throw ModuleError.from(e, errors.INVALID_JSON_PAYLOAD);
    }
    return this.sendEmail(undefined, emailParams, emailRecord.contentFile);
  }

  async getEmailStatus(messageId: string) {
    if (!this.isAvailable()) throw new ModuleError(errors.EMAIL_NOT_CONFIGURED);
    return this.callTransport(() => this.emailer!.getEmailStatus(messageId));
  }
}
