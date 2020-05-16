import { ConduitSDK } from '../../index';
import { IConduitModule } from '../../interfaces/IConduitModule';

export abstract class IConduitStorage implements IConduitModule {

  constructor(conduit: ConduitSDK) {
  }

  abstract setConfig(newConfig: any): Promise<any>;
}
