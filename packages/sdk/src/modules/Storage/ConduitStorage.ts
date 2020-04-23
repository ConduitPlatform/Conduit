import { ConduitSDK } from '../../index';

export abstract class IConduitStorage {

  constructor(conduit: ConduitSDK) {
  }

  abstract validateConfig(config: any): boolean;

  abstract initModule(): Promise<boolean>;

}
