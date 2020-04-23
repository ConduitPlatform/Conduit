import { ConduitSDK } from '../../index';

export abstract class IConduitPushNotifications {

  constructor(conduit: ConduitSDK) {
  }

  abstract validateConfig(config: any): boolean;
  abstract initModule(): Promise<boolean>;
}
