import { ConduitRouteParameters, ConduitSDK } from '../../index';

export abstract class IConduitAuthentication {
  constructor(sdk: ConduitSDK) {
  }

  abstract validateConfig(config: any): boolean;
  abstract initModule(): Promise<boolean>;
  abstract get middleware(): (request: ConduitRouteParameters) => Promise<any>;
}
