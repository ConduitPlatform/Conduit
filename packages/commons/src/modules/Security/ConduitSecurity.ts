import { ConduitCommons } from '../..';

export abstract class IConduitSecurity {
  protected constructor(protected readonly commons: ConduitCommons) {}

  setConfig(moduleConfig: any) {
    this.commons.getSecurity().registerAdminRoutes(moduleConfig.clientValidation.enabled);
    this.commons.getBus().publish('config:update:security', JSON.stringify(moduleConfig));
  }

  abstract registerAdminRoutes(clientValidation: boolean): void;
}
