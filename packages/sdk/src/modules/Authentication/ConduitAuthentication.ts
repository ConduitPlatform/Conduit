import { ConduitRouteParameters, ConduitSDK, IConduitModule } from '../../index';

export abstract class IConduitAuthentication implements IConduitModule{
  constructor(sdk: ConduitSDK) {
  }

  abstract get middleware(): (request: ConduitRouteParameters) => Promise<any>;
  abstract setConfig(newConfig: any): Promise<any>;

}
