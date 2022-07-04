import { GrpcServer } from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ConduitCommons } from '../../index';

export abstract class IConduitAdmin {
  protected constructor(protected readonly commons: ConduitCommons) {}

  abstract initialize(server: GrpcServer): Promise<void>;
  abstract subscribeToBusEvents(): Promise<void>;
  abstract registerRoute(route: ConduitRoute): void;
  abstract setConfig(moduleConfig: any): Promise<any>;

  protected abstract onConfig(): void;
}
