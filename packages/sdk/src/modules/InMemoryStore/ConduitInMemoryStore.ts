import { ConduitSDK, IConduitModule } from '../../index';

export abstract class IConduitInMemoryStore implements IConduitModule {

  constructor(conduit: ConduitSDK) {
  }

  abstract get(key: string): Promise<any>;

  abstract store(key: string, value: any): Promise<any>;

  abstract setConfig(newConfig: any): Promise<any>;

}
