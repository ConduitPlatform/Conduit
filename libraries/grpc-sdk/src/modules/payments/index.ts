import * as grpc from "grpc";
import path from "path";
import {ConduitModule} from "../../interfaces/ConduitModule";

let protoLoader = require("@grpc/proto-loader");

export default class Payments implements ConduitModule {
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;

  constructor(url: string ) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    let packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, "../../proto/payments.proto"),
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
    const payments = protoDescriptor.payments.Payments;
    this.client = new payments(this._url, grpc.credentials.createInsecure(), {
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
      this.client.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      )
    });
  }

  createPayment(params: {
    productId: string
  }) {
    return new Promise((resolve, reject) => {
      this.client.createPayment(
        {
          productId: params.productId
        },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve({ clientSecret: res.clientSecret, paymentId: res.paymentId });
          }
        }
      )
    });
  }
}