import { ConduitSDK } from '../../index';

export abstract class IConduitStorage {

  constructor(conduit: ConduitSDK) {
  }

  abstract initModule(): Promise<boolean>;

}
