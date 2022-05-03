import { ConduitCommons } from '../..';

export abstract class IConduitCore {
  protected constructor(protected readonly commons: ConduitCommons) {}

  setConfig(moduleConfig: any) {
    this.commons.getBus().publish('config:update:core', JSON.stringify(moduleConfig));
  };
}
