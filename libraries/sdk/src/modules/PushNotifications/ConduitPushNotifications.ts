import { ConduitSDK, IConduitModule } from '../../index';

export abstract class IConduitPushNotifications implements IConduitModule{

  constructor(conduit: ConduitSDK) {
  }

  abstract setConfig(newConfig: any): Promise<any>;

}
