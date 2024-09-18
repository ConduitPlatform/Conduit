import { ConduitModule } from '../../../classes/index.js';
import {
  SendSmsResponse,
  SendVerificationCodeResponse,
  SmsDefinition,
  VerifyResponse,
} from '../../../protoUtils/index.js';

export class SMS extends ConduitModule<typeof SmsDefinition> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'sms', url, grpcToken);
    this.initializeClient(SmsDefinition);
  }

  sendSms(to: string, message: string): Promise<SendSmsResponse> {
    return this.client!.sendSms({ to, message });
  }

  sendVerificationCode(to: string): Promise<SendVerificationCodeResponse> {
    return this.client!.sendVerificationCode({ to });
  }

  verify(verificationSid: string, code: string): Promise<VerifyResponse> {
    return this.client!.verify({ verificationSid, code });
  }
}
