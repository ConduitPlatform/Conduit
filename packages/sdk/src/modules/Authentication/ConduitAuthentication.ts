import { ConduitRouteParameters, ConduitSDK } from '../../index';

export abstract class IConduitAuthentication {
  constructor(sdk: ConduitSDK) {
  }

  abstract initModule(): Promise<boolean>;
  abstract get middleware(): (request: ConduitRouteParameters) => Promise<any>;
}
