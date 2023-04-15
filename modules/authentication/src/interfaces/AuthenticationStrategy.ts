import { RoutingManager } from '@conduitplatform/module-tools';

export interface IAuthenticationStrategy {
  validate(): Promise<boolean>;

  declareRoutes(routingManager: RoutingManager): void;
}
