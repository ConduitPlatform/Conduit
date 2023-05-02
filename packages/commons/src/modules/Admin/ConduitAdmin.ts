import { ConduitRoute } from '@conduitplatform/hermes';
import { ConduitCommons } from '../../index';
import convict from 'convict';
import { GrpcServer } from '@conduitplatform/module-tools';

export abstract class IConduitAdmin {
  protected constructor(protected readonly commons: ConduitCommons) {}

  abstract initialize(server: GrpcServer): Promise<void>;

  abstract subscribeToBusEvents(): Promise<void>;

  abstract registerRoute(route: ConduitRoute): void;

  abstract setConfig(moduleConfig: any): Promise<any>;

  abstract handleConfigUpdate(config: convict.Config<any>): void;

  protected abstract onConfig(): void;
}
