import { isEmpty, isNil } from 'lodash-es';
import { EmailRecord, EmailTemplate } from '../models/index.js';
import handlebars from 'handlebars';
import { ConduitGrpcSdk, GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
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
  attachments?: string[];
}

export class EmailService implements IChannel {
  private emailer?: EmailProvider;
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public async initEmailProvider(config: Config) {
    const emailConfig = config.email;

    if (!emailConfig || !emailConfig.transport || !emailConfig.transportSettings) {
      ConduitGrpcSdk.Logger.warn('Email not configured');
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
        attachments,
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
        error: (error as Error).message,
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
          | 'pending'
          | 'sent'
          | 'delivered'
          | 'failed'
          | 'bounced',
        messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        messageId,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  getExternalTemplates() {
    if (!this.isAvailable()) throw new Error('Email not configured');
    return this.emailer!._transport?.listTemplates();
  }

  getExternalTemplate(id: string) {
    if (!this.isAvailable()) throw new Error('Email not configured');
    return this.emailer!._transport?.getTemplateInfo(id);
  }

  createExternalTemplate(data: CreateEmailTemplate): Promise<Template> {
    if (!this.isAvailable()) throw new Error('Email not configured');
    return (
      this.emailer!._transport?.createTemplate(data) ??
      Promise.reject(new Error('Transport is not available'))
    );
  }

  deleteExternalTemplate(id: string) {
    if (!this.isAvailable()) throw new Error('Email not configured');
    return this.emailer!._transport?.deleteTemplate(id);
  }

  async registerTemplate(params: IRegisterTemplateParams) {
    const { name, body, subject, variables, sender, jsonTemplate } = params;

    const existing = await EmailTemplate.getInstance().findOne({ name });
    if (!isNil(existing)) return existing;

    return EmailTemplate.getInstance().create({
      name,
      subject,
      body,
      sender,
      variables,
      jsonTemplate,
    });
  }

  async updateTemplate(id: string, params: IUpdateTemplateParams) {
    if (!this.isAvailable()) throw new Error('Email not configured');
    const templateDocument = await EmailTemplate.getInstance().findOne({
      _id: id,
    });
    if (isNil(templateDocument)) {
      throw new GrpcError(status.NOT_FOUND, 'Template does not exist');
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
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

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
      await this.emailer!._transport?.updateTemplate(data).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }

    return { template: updatedTemplate };
  }

  async sendEmail(
    template: string | undefined,
    params: ISendEmailParams,
    contentFileId?: string,
  ) {
    if (!this.isAvailable()) throw new Error('Email not configured');
    const { email, body, subject, variables, sender } = params;
    const builder = this.emailer!.emailBuilder();

    if (!template && (!body || !subject)) {
      throw new Error(`Template/body+subject not provided`);
    }

    let subjectString = subject!;
    let bodyString = body!;
    let templateFound: EmailTemplate | null = null;
    let senderAddress: string | undefined;
    if (template) {
      templateFound = await EmailTemplate.getInstance().findOne({ name: template });
      if (isNil(templateFound)) {
        throw new Error(`Template ${template} not found`);
      }
      if (isNil(templateFound.subject) && isNil(subject)) {
        throw new Error(`Subject is missing both in body params and template.`);
      }
      if (templateFound.externalManaged) {
        builder.setTemplate({
          id: templateFound.externalId!,
          variables: variables as Indexable,
        });
      } else {
        bodyString = handlebars.compile(templateFound.body)(variables);
      }
      if (!isNil(templateFound.subject) && isNil(subject)) {
        subjectString = handlebars.compile(templateFound.subject)(variables);
      }
      if (!isEmpty(templateFound.sender)) {
        senderAddress = templateFound.sender;
      }
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
        throw new Error(
          `Sending domain is not set, and sender address is not valid: ${senderAddress}`,
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

    const sentMessageInfo = await this.emailer!.sendEmail(builder);
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
      );

      if (messageId) {
        await QueueController.getInstance().addEmailStatusJob(messageId, emailRecId, 0);
      }
    }
    return { messageId, ...sentMessageInfo };
  }

  async resendEmail(emailRecordId: string) {
    if (!this.grpcSdk.isAvailable('storage')) {
      throw new GrpcError(status.INTERNAL, 'Storage is not available.');
    }
    const emailRecord = await EmailRecord.getInstance().findOne({ _id: emailRecordId });
    if (isNil(emailRecord)) {
      throw new GrpcError(status.NOT_FOUND, 'Email record not found.');
    }
    const contentFileData = await this.grpcSdk.storage!.getFileData(
      emailRecord.contentFile,
    );
    if (!contentFileData) {
      throw new GrpcError(status.NOT_FOUND, 'Email content file not found.');
    }
    const dataString = Buffer.from(contentFileData.data, 'base64').toString('utf-8');
    return this.sendEmail(undefined, JSON.parse(dataString), emailRecord.contentFile);
  }

  async getEmailStatus(messageId: string) {
    if (!this.isAvailable()) return Promise.reject('Email not configured');
    return this.emailer!.getEmailStatus(messageId);
  }
}
