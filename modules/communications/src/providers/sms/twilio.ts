import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import twilio from 'twilio';
import { ISmsProvider } from './interfaces/ISmsProvider.js';

export class TwilioProvider implements ISmsProvider {
  private readonly phoneNumber: string;
  private readonly accountSID: string;
  private readonly authToken: string;
  private readonly serviceSid: string | undefined;
  private client: twilio.Twilio;

  constructor(settings: {
    phoneNumber: string;
    accountSID: string;
    authToken: string;
    verify: { active: boolean; serviceSid: string | undefined };
  }) {
    ({
      phoneNumber: this.phoneNumber,
      accountSID: this.accountSID,
      authToken: this.authToken,
    } = settings);

    this.serviceSid = settings.verify.serviceSid;
    this.client = twilio(this.accountSID, this.authToken);
  }

  sendSms(to: string, message: string) {
    return this.client.messages.create({
      body: message,
      to,
      from: this.phoneNumber,
    });
  }

  async sendVerificationCode(to: string) {
    if (this.serviceSid === undefined) {
      return Promise.reject(Error('no service sid specified'));
    }

    const verification = await this.client.verify.v2
      .services(this.serviceSid)
      .verifications.create({ to, channel: 'sms' })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    if (!verification) {
      return Promise.reject(Error('could not send verification code'));
    }

    return Promise.resolve(verification.sid);
  }

  async verify(verificationSid: string, code: string): Promise<boolean> {
    if (this.serviceSid === undefined) {
      return Promise.reject(Error('no service sid specified'));
    }
    const verificationCheck = await this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({ verificationSid, code })
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });

    if (!verificationCheck) {
      return Promise.reject(Error('could not verify code'));
    }

    return Promise.resolve(verificationCheck.status === 'approved');
  }
}
