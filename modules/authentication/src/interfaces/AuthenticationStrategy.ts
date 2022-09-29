import { RoutingManager } from '@conduitplatform/grpc-sdk';

export interface IAuthenticationStrategy {
  validate(): Promise<boolean>;

  declareRoutes(routingManager: RoutingManager): void;
}
