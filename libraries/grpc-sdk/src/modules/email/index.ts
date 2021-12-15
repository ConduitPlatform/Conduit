import { ConduitModule } from '../../classes/ConduitModule';
import { EmailClient } from '../../protoUtils/email';

export class Email extends ConduitModule<EmailClient> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(EmailClient);
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  registerTemplate(template: {
    name: string;
    subject: string;
    body: string;
    variables: string[];
  }) {
    return new Promise((resolve, reject) => {
      this.client?.registerTemplate(
        {
          name: template.name,
          subject: template.subject,
          body: template.body,
          variables: template.variables,
        },
        (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(JSON.parse(res.template));
          }
        }
      );
    });
  }

  sendEmail(
    templateName: string,
    params: {
      email: string;
      variables: any;
      sender: string;
      replyTo?: string;
      cc?: string[];
      attachments?: string[];
    }
  ) {
    return new Promise((resolve, reject) => {
      this.client?.sendEmail(
        {
          templateName,
          params: {
            email: params.email,
            variables: JSON.stringify(params.variables),
            sender: params.sender,
            replyTo: params.replyTo,
            cc: params.cc ?? [],
            attachments: params.attachments ?? [],
          },
        },
        (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(res.sentMessageInfo);
          }
        }
      );
    });
  }
}
