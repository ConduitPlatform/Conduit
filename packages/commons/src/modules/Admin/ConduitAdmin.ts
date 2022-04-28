import { GrpcServer } from '@conduitplatform/grpc-sdk';
import { ConduitCommons, ConduitRoute } from '../../index';

export abstract class IConduitAdmin {
  protected constructor(protected readonly commons: ConduitCommons) {}

  abstract initialize(server: GrpcServer): Promise<void>;
  abstract registerRoute(route: ConduitRoute): void;

  setConfig(moduleConfig: any) {
    this.commons.getBus().publish('config:update:admin', JSON.stringify(moduleConfig));
  };
}
