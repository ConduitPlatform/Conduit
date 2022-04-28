import { ConduitModule } from '../../classes/ConduitModule';
import { SendSmsResponse, SendVerificationCodeResponse, SmsDefinition, VerifyResponse } from '../../protoUtils/sms';

export class SMS extends ConduitModule<typeof SmsDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, 'sms', url);
    this.initializeClient(SmsDefinition);
  }

  setConfig(newConfig: any): Promise<any> {
    return this.client!.setConfig(
      { newConfig: JSON.stringify(newConfig) })
      .then(res => {
        return JSON.parse(res.updatedConfig);
      });
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
