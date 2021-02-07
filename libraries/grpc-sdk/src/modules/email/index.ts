import * as grpc from "grpc";
import path from "path";
import {ConduitModule} from "../../interfaces/ConduitModule";

let protoLoader = require("@grpc/proto-loader");

export default class Email implements ConduitModule{
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;

  constructor(url: string) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    let packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "../../proto/email.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    let email = protoDescriptor.email.Email;
    this.client = new email(this._url, grpc.credentials.createInsecure(), {
      "grpc.max_receive_message_length": 1024 * 1024 * 100,
      "grpc.max_send_message_length": 1024 * 1024 * 100
    });
    this.active = true;
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig({ newConfig: JSON.stringify(newConfig) }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(JSON.parse(res.updatedConfig));
        }
      });
    });
  }

  registerTemplate(template: { name: string; subject: string; body: string; variables: string[] }) {
    return new Promise((resolve, reject) => {
      this.client.registerTemplate(
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

  sendEmail(templateName: string, params: { email: string; variables: any; sender: string, replyTo?: string, cc?: string[], attachments?: string[] }) {
    return new Promise((resolve, reject) => {
      this.client.sendEmail(
        {
          templateName,
          params: {
            email: params.email,
            variables: JSON.stringify(params.variables),
            sender: params.sender,
            replyTo: params.replyTo,
            cc: params.cc,
            attachments: params.attachments
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
