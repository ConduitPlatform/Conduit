import { ConduitModule } from '../../classes/index.js';
import { CommsDefinition } from '../../protoUtils/index.js';
import { Email } from './email';
import { SMS } from './sms';
import { PushNotifications } from './pushNotifications';

export class Comms extends ConduitModule<typeof CommsDefinition> {
  private readonly _email: Email;
  private readonly _sms: SMS;
  private readonly _pushNotifications: PushNotifications;

  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'comms', url, grpcToken);
    this.initializeClient(CommsDefinition);
    this._email = new Email(moduleName, url, grpcToken);
    this._sms = new SMS(moduleName, url, grpcToken);
    this._pushNotifications = new PushNotifications(moduleName, url, grpcToken);
  }

  get email() {
    return this._email;
  }

  get sms() {
    return this._sms;
  }

  get pushNotifications() {
    return this._pushNotifications;
  }

  featureAvailable(name: string) {
    return this.client!.featureAvailable({ serviceName: name });
  }
}
