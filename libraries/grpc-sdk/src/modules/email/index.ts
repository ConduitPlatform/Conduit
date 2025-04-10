import { ConduitModule } from '../../classes/index.js';
import { EmailDefinition } from '../../protoUtils/email.js';

export class Email extends ConduitModule<typeof EmailDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'email', url, grpcToken);
    this.initializeClient(EmailDefinition);
  }

  registerTemplate(template: {
    name: string;
    subject: string;
    body: string;
    variables: string[];
    sender?: string;
  }) {
    return this.client!.registerTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      sender: template.sender,
    }).then(res => {
      return JSON.parse(res.template);
    });
  }

  updateTemplate(
    templateId: string,
    params: {
      name?: string;
      subject?: string;
      body?: string;
      variables?: string[];
      sender?: string;
    },
  ) {
    return this.client!.updateTemplate({
      id: templateId,
      name: params.name,
      subject: params.subject,
      body: params.body,
      variables: params.variables,
      sender: params.sender,
    }).then(res => {
      return JSON.parse(res.template);
    });
  }

  sendEmail(
    templateName: string,
    params: {
      email: string;
      variables: any;
      sender?: string;
      replyTo?: string;
      cc?: string[];
      attachments?: string[];
    },
  ) {
    return this.client!.sendEmail({
      templateName,
      params: {
        email: params.email,
        variables: JSON.stringify(params.variables),
        sender: params.sender,
        replyTo: params.replyTo,
        cc: params.cc ?? [],
        attachments: params.attachments ?? [],
      },
    }).then(res => {
      return res.sentMessageInfo;
    });
  }

  resendEmail(emailRecordId: string) {
    return this.client!.resendEmail({ emailRecordId }).then(res => {
      return res.sentMessageInfo;
    });
  }

  getEmailStatus(messageId: string) {
    return this.client!.getEmailStatus({ messageId }).then(res => {
      return JSON.parse(res.statusInfo);
    });
  }
}
