import { isNil } from 'lodash';
import { EmailTemplate } from '../models';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { IRegisterTemplateParams, ISendEmailParams } from '../interfaces';
import handlebars from 'handlebars';
import { EmailProvider } from '../email-provider';
import { CreateEmailTemplate } from '../email-provider/interfaces/CreateEmailTemplate';
import { UpdateEmailTemplate } from '../email-provider/interfaces/UpdateEmailTemplate';
export class EmailService {
  private database: any;

  constructor(private emailer: EmailProvider, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    this.grpcSdk.waitForExistence('database-provider').then((r) => {
      self.database = self.grpcSdk.databaseProvider;
    });
  }

  updateProvider(emailer: EmailProvider) {
    this.emailer = emailer;
  }

  getExternalTemplates() {
    return this.emailer._transport?.listTemplates();
  }

  getExternalTemplate(id: string) {
    return this.emailer._transport?.getTemplateInfo(id);
  }

  createExternalTemplate(data: CreateEmailTemplate) {
    return this.emailer._transport?.createTemplate(data);
  }

  updateTemplate(data: UpdateEmailTemplate) {
    return this.emailer._transport?.updateTemplate(data);
  }

  deleteExternalTemplate(id: string) {
    return this.emailer._transport?.deleteTemplate(id);
  }

  async registerTemplate(params: IRegisterTemplateParams) {
    const { name, body, subject, variables } = params;

    const existing = await EmailTemplate.getInstance().findOne({ name });
    if (!isNil(existing)) return existing;

    return EmailTemplate.getInstance().create({
      name,
      subject,
      body,
      variables,
    });
  }

  async sendEmail(template: string, params: ISendEmailParams) {
    const { email, body, subject, variables, sender } = params;

    const builder = this.emailer.emailBuilder();

    if (!template && (!body || !subject)) {
      throw new Error(`Template/body+subject not provided`);
    }

    let templateFound: EmailTemplate | null;
    if (template) {
      templateFound = await EmailTemplate.getInstance().findOne({ name: template });
      if (isNil(templateFound)) {
        throw new Error(`Template ${template} not found`);
      }
    }

    if (!isNil(sender)) {
      builder.setSender(sender);
    } else if (!isNil(templateFound!.sender) && isNil(sender)) {
      builder.setSender(templateFound!.sender);
    } else {
      throw new Error(`Sender must be provided!`);
    }

    if (templateFound!.externalManaged) {
      builder.setTemplate({
        id: templateFound!._id,
        variables: variables as any,
      });
    } else {
      let handled_body = handlebars.compile(templateFound!.body);
      const bodyString = templateFound! ? handled_body(variables) : body!;
      builder.setContent(bodyString);
    }
    let handled_subject = handlebars.compile(templateFound!.subject);

    const subjectString = templateFound! ? handled_subject(variables) : subject!;

    builder.setSender(sender);
    builder.setReceiver(email);
    builder.setSubject(subjectString);

    if (params.cc) {
      builder.setCC(params.cc);
    }

    if (params.replyTo) {
      builder.setReplyTo(params.replyTo);
    }

    if (params.attachments) {
      builder.addAttachments(params.attachments as any);
    }
    return this.emailer.sendEmail(builder);
  }
}
