import { ConduitModule } from '../../classes/index.js';
import { CommunicationsDefinition } from '../../protoUtils/index.js';

export class SMS extends ConduitModule<typeof CommunicationsDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    // Connect to communications module instead of sms
    super(moduleName, 'communications', url, grpcToken);
    this.initializeClient(CommunicationsDefinition);
  }

  sendSms(to: string, message: string) {
    return this.client!.sendSms({ to, message });
  }

  sendVerificationCode(to: string) {
    return this.client!.sendVerificationCode({ to });
  }

  verify(verificationSid: string, code: string) {
    return this.client!.verify({ verificationSid, code });
  }
}
