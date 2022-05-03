import { ConduitCommons, ConduitRoute } from '../..';

export abstract class IConduitAdmin {
  protected constructor(protected readonly commons: ConduitCommons) {}

  abstract initialize(): void;
  abstract registerRoute(route: ConduitRoute): void;

  setConfig(moduleConfig: any) {
    this.commons.getBus().publish('config:update:admin', JSON.stringify(moduleConfig));
  };
}
