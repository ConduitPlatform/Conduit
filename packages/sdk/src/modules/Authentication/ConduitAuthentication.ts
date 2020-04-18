import { ConduitRouteParameters, ConduitSDK } from '../../index';

export abstract class IConduitAuthentication {
  constructor(sdk: ConduitSDK) {
  }

  abstract get middleware(): (request: ConduitRouteParameters) => Promise<any>;
}
