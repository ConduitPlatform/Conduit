import { ConduitSDK } from '../../index';

export abstract class IConduitInMemoryStore {

  constructor(conduit: ConduitSDK) {
  }

  abstract get(key: string): Promise<any>;

  abstract store(key: string, value: any): Promise<any>;

}
