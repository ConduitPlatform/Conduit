import { ConduitModule } from '../../classes/ConduitModule';
import { PaymentsClient } from '../../protoUtils/payments';

export class Payments extends ConduitModule<PaymentsClient> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
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
}
