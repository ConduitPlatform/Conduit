import { ConduitModule } from "../../classes/ConduitModule";
import { FormsClient } from "../../protoUtils/forms";

export class Forms extends ConduitModule<FormsClient>{
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(FormsClient);
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
