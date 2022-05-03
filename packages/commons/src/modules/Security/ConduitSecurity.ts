import { ConduitCommons } from '../..';

export abstract class IConduitSecurity {
  protected constructor(protected readonly commons: ConduitCommons) {}

  setConfig(moduleConfig: any) {
    // TODO: Re-register routes etc
    this.commons.getBus().publish('config:update:security', JSON.stringify(moduleConfig));
  };
}
