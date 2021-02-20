import path from "path";
import {ConduitModule} from "../../classes/ConduitModule";


export default class Payments extends ConduitModule {

  constructor(url: string ) {
    super(url);
    this.protoPath = path.resolve(__dirname, "../../proto/payments.proto");
    this.descriptorObj = "payments.Payments";
    this.initializeClient();
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

  createIamportPayment(productId: string, quantity: number, userId: string | null) {
    return new Promise((resolve, reject) => {
      this.client.createIamportPayment({ productId, quantity, userId },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve({ merchant_uid: res.merchant_uid, amount: res.amount });
          }
        })
    });
  }

  completeIamportPayment(imp_uid: string, merchant_uid: string) {
    return new Promise((resolve, reject) => {
      this.client.completeIamportPayment({ imp_uid, merchant_uid },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || "Something went wrong");
          } else {
            resolve(res.success);
          }
        })
    });
  }
}
