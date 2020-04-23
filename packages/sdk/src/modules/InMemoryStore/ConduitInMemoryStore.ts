import { ConduitSDK } from '../../index';

export abstract class IConduitInMemoryStore {

  constructor(conduit: ConduitSDK) {
  }

  abstract initModule(): Promise<{result: boolean, error?: any}>;

  abstract get(key: string): Promise<any>;

  abstract store(key: string, value: any): Promise<any>;

}
