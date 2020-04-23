import { ConduitSDK } from '../../index';

export abstract class IConduitInMemoryStore {

  constructor(conduit: ConduitSDK) {
  }

  abstract initModule(): Promise<boolean>;

  abstract get(key: string): Promise<any>;

  abstract store(key: string, value: any): Promise<any>;

}
