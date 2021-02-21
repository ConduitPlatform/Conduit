export interface ISmsProvider {
  sendSms(to: string, message: string): Promise<any>;
  sendVerificationCode(to: string): Promise<string>;
  verify(verificationSid: string, code: string): Promise<boolean>;
}
