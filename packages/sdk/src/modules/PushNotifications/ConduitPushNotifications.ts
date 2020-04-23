import { ConduitSDK } from '../../index';

export abstract class IConduitPushNotifications {

  constructor(conduit: ConduitSDK) {
  }

  abstract initModule(): Promise<boolean>;
}
