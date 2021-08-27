import { ConduitModule } from '../../classes/ConduitModule';
import { PaymentsClient } from '../../protoUtils/payments';

export class Payments extends ConduitModule<PaymentsClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(PaymentsClient);
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

  createIamportPayment(productId: string, quantity: number, userId: string = '') {
    return new Promise((resolve, reject) => {
      this.client?.createIamportPayment(
        { productId, quantity, userId },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve({ merchant_uid: res.merchant_uid, amount: res.amount });
          }
        }
      );
    });
  }

  completeIamportPayment(impUid: string, merchantUid: string) {
    return new Promise((resolve, reject) => {
      this.client?.completeIamportPayment(
        { impUid, merchantUid },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(res.success);
          }
        }
      );
    });
  }
}
