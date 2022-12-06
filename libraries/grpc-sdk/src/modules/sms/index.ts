import { ConduitModule } from '../../classes/ConduitModule';
import {
  SendSmsResponse,
  SendVerificationCodeResponse,
  SmsDefinition,
  VerifyResponse,
} from '../../protoUtils/sms';

export class SMS extends ConduitModule<typeof SmsDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'sms', url, grpcToken);
    this.initializeClients(SmsDefinition);
  }

  sendSms(to: string, message: string): Promise<SendSmsResponse> {
    return this.serviceClient!.sendSms({ to, message });
  }

  sendVerificationCode(to: string): Promise<SendVerificationCodeResponse> {
    return this.serviceClient!.sendVerificationCode({ to });
  }

  verify(verificationSid: string, code: string): Promise<VerifyResponse> {
    return this.serviceClient!.verify({ verificationSid, code });
  }
}
