import { isEmpty, isNil } from 'lodash-es';
import { EmailTemplate, EmailRecord } from '../models/index.js';
import { IRegisterTemplateParams, ISendEmailParams } from '../interfaces/index.js';
import handlebars from 'handlebars';
import { EmailProvider } from '../email-provider/index.js';
import { CreateEmailTemplate } from '../email-provider/interfaces/CreateEmailTemplate.js';
import { UpdateEmailTemplate } from '../email-provider/interfaces/UpdateEmailTemplate.js';
import { Attachment } from 'nodemailer/lib/mailer';
import { Template } from '../email-provider/interfaces/Template.js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Config } from '../config/index.js';
import { status } from '@grpc/grpc-js';
import { storeEmail } from '../utils/index.js';

export class EmailService {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private emailer: EmailProvider,
  ) {}

  updateProvider(emailer: EmailProvider) {
    this.emailer = emailer;
  }

  getExternalTemplates() {
    return this.emailer._transport?.listTemplates();
  }

  getExternalTemplate(id: string) {
    return this.emailer._transport?.getTemplateInfo(id);
  }

  createExternalTemplate(data: CreateEmailTemplate): Promise<Template> {
    return (
      this.emailer._transport?.createTemplate(data) ??
      Promise.reject(new Error('Transport is not available'))
    );
  }

  updateTemplate(data: UpdateEmailTemplate) {
    return this.emailer._transport?.updateTemplate(data);
  }

  deleteExternalTemplate(id: string) {
    return this.emailer._transport?.deleteTemplate(id);
  }

  async registerTemplate(params: IRegisterTemplateParams) {
    const { name, body, subject, variables, sender } = params;

    const existing = await EmailTemplate.getInstance().findOne({ name });
    if (!isNil(existing)) return existing;

    return EmailTemplate.getInstance().create({
      name,
      subject,
      body,
      sender,
      variables,
    });
  }

  async sendEmail(
    template: string | undefined,
    params: ISendEmailParams,
    contentFileId?: string,
  ) {
    const { email, body, subject, variables, sender } = params;
    const builder = this.emailer.emailBuilder();

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
        builder.setTemplate({ id: templateFound._id, variables: variables });
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
    if (isNil(params.sendingDomain) || isEmpty(params.sendingDomain)) {
      if (senderAddress.includes('@')) {
        ConduitGrpcSdk.Logger.warn(
          `Sending domain is not set, attempting to send email with provided address: ${senderAddress}`,
        );
      } else {
        throw new Error(
          `Sending domain is not set, and sender address is not valid: ${senderAddress}`,
        );
      }
    } else if (!senderAddress.includes(params.sendingDomain)) {
      if (senderAddress.includes('@')) {
        ConduitGrpcSdk.Logger.warn(
          `You are trying to send email from ${senderAddress} but it does not match sending domain ${params.sendingDomain}`,
        );
      } else {
        senderAddress = `${senderAddress}@${params.sendingDomain}`;
      }
    }
    builder.setSender(senderAddress!);
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

    const sentMessageInfo = await this.emailer.sendEmail(builder);
    const messageId = this.emailer._transport?.getMessageId(sentMessageInfo);

    const config = ConfigController.getInstance().config as Config;
    if (config.storeEmails.enabled) {
      await storeEmail(this.grpcSdk, messageId, templateFound, contentFileId, {
        body: bodyString,
        subject: subjectString,
        ...params,
      }).catch(e => {
        ConduitGrpcSdk.Logger.error('Failed to store email', e);
      });
    }
    return { messageId, ...sentMessageInfo };
  }

  async resendEmail(messageId: string) {
    if (!this.grpcSdk.isAvailable('storage')) {
      throw new GrpcError(status.INTERNAL, 'Storage is not available.');
    }
    const emailRecord = await EmailRecord.getInstance().findOne({ messageId });
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
    return this.emailer.getEmailStatus(messageId);
  }
}
