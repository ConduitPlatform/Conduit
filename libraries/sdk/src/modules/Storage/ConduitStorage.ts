import { ConduitSDK } from '../../index';
import { IConduitModule } from '../../interaces/IConduitModule';

export abstract class IConduitStorage implements IConduitModule {

  constructor(conduit: ConduitSDK) {
  }

  abstract setConfig(newConfig: any): Promise<any>;
}
