import * as grpc from "grpc";
import path from "path";

let protoLoader = require("@grpc/proto-loader");

export default class SMS {
  private readonly client: any;

  constructor(url: string) {
    let packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, "../../proto/sms.proto"),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const sms = protoDescriptor.sms.Sms;
    this.client = new sms(url, grpc.credentials.createInsecure());
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  sendVerificationCode(params: {to: string}) {
    return new Promise((resolve, reject) => {
      this.client.sendVerificationCode(
        {to: params.to},
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve(res.verificationSid)
          }
        }

      )
    });
  }

  verify(params: {verificationSid: string, code: string}) {
    return new Promise((resolve, reject) => {
      this.client.verify(
        {verificationSid: params.verificationSid, code: params.code},
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve(res.verified)
          }
        }

      )
    });
  }
}
