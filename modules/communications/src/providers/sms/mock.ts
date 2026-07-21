import { randomUUID } from 'crypto';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ISmsProvider } from './interfaces/ISmsProvider.js';

const MOCK_VERIFICATION_CODE = '123456';

export class MockSmsProvider implements ISmsProvider {
  sendSms(to: string, message: string): Promise<any> {
    ConduitGrpcSdk.Logger.log(`[MOCK SMS] To: ${to} | Message: ${message}`);
    return Promise.resolve({
      sid: `mock-sms-${randomUUID()}`,
      status: 'sent',
    });
  }

  sendVerificationCode(to: string): Promise<string> {
    ConduitGrpcSdk.Logger.log(
      `[MOCK SMS] Verification code sent to: ${to} (code: ${MOCK_VERIFICATION_CODE})`,
    );
    return Promise.resolve(`mock-verify-${randomUUID()}`);
  }

  verify(_verificationSid: string, code: string): Promise<boolean> {
    return Promise.resolve(code === MOCK_VERIFICATION_CODE);
  }
}
