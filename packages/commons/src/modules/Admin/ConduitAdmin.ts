import { GrpcServer, ConfigController } from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '../../index';
import { ConduitRoute } from '@conduitplatform/hermes';

export abstract class IConduitAdmin {
  protected constructor(protected readonly commons: ConduitCommons) {}

  abstract initialize(server: GrpcServer): Promise<void>;
  abstract subscribeToBusEvents(): Promise<void>;
  abstract registerRoute(route: ConduitRoute): void;

  setConfig(moduleConfig: any) {
    ConfigController.getInstance().config = moduleConfig;
    this.commons.getBus().publish('config:update:admin', JSON.stringify(moduleConfig));
  }

  protected abstract onConfig(): void;
}
