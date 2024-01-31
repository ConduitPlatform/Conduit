import { ConduitCommons } from '../../index.js';

export abstract class IConduitCore {
  protected constructor(protected readonly commons: ConduitCommons) {}

  abstract setConfig(moduleConfig: any): Promise<any>;
}
