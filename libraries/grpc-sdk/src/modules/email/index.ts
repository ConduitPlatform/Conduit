import * as grpc from 'grpc';
import path from 'path';

let protoLoader = require('@grpc/proto-loader');

export default class Email {
  private readonly client: any;

  constructor(url: string) {
    let packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, '../../proto/email.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );
    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    let email = protoDescriptor.email.Email;
    this.client = new email(url, grpc.credentials.createInsecure());
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig({newConfig: JSON.stringify(newConfig)},
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        })
    });
  }

  registerTemplate(template: {name: string, subject: string, body: string, variables: string[]}) {
    return new Promise((resolve, reject) => {
      this.client.registerTemplate(
        {
          name: template.name,
          subject: template.subject,
          body: template.body,
          variables: template.variables
        },(err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(JSON.parse(res.template));
          }
        })
    });
  }

  sendEmail(templateName: string, params: {email: string, variables: any, sender: string}) {
    return new Promise((resolve, reject) => {
      this.client.sendEmail(
        {
          templateName,
          params: {
            email: params.email,
            variables: JSON.stringify(params.variables),
            sender: params.sender
          }
        }, (err: any, res: any) => {
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
