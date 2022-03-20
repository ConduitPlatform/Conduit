import {
  ManagedModule,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema from './config';
import { AdminHandlers } from './admin/admin';
import {
  SendSmsRequest,
  SendSmsResponse,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  VerifyRequest, VerifyResponse
} from './types';
import { ISmsProvider } from './interfaces/ISmsProvider';
import { TwilioProvider } from './providers/twilio';
import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';

export default class Sms extends ManagedModule {
  config = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'sms.proto'),
    protoDescription: 'sms.Sms',
    functions: {
      setConfig: this.setConfig.bind(this),
      sendSms: this.sendSms.bind(this),
      sendVerificationCode: this.sendVerificationCode.bind(this),
      verify: this.verify.bind(this),
    },
  };
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private _provider: ISmsProvider | undefined;

  constructor() {
    super('sms');
  }

  async onServerStart() {
    await this.grpcSdk.waitForExistence('database');
    this.adminRouter = new AdminHandlers(this.grpcServer, this.grpcSdk, this._provider);
  }

  async preConfig(config: any) {
    if (
      isNil(config.active) ||
      isNil(config.providerName) ||
      isNil(config[config.providerName])
    ) {
      throw new Error('Invalid configuration given');
    }
    return config;
  }

  async onConfig() {
    await this.initProvider();
    this.adminRouter.updateProvider(this._provider!);
    this.isRunning = true;
  }

  private async initProvider() {
    const smsConfig = ConfigController.getInstance().config;
    const name = smsConfig.providerName;
    const settings = smsConfig[name];

    if (name === 'twilio') {
      this._provider = new TwilioProvider(settings);
    } else {
      console.error('SMS provider not supported');
      process.exit(-1);
    }
  }

  // gRPC Service
  async sendSms(call: SendSmsRequest, callback: SendSmsResponse) {
    const to = call.request.to;
    const message = call.request.message;
    if (isNil(this._provider)) {
      return callback({ code: status.INTERNAL, message: 'No sms provider' });
    }

    let errorMessage: string | null = null;
    await this._provider
      .sendSms(to, message)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { message: 'SMS sent' });
  }

  async sendVerificationCode(
    call: SendVerificationCodeRequest,
    callback: SendVerificationCodeResponse
  ) {
    const to = call.request.to;
    if (isNil(this._provider)) {
      return callback({ code: status.INTERNAL, message: 'No sms provider' });
    }
    if (isNil(to)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'No sms recipient',
      });
    }

    let errorMessage: string | null = null;
    const verificationSid = await this._provider
      .sendVerificationCode(to)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verificationSid });
  }

  async verify(call: VerifyRequest, callback: VerifyResponse) {
    const { verificationSid, code } = call.request;
    if (isNil(this._provider)) {
      return callback({ code: status.INTERNAL, message: 'No sms provider' });
    }
    if (isNil(verificationSid) || isNil(code)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'No verification id or code provided',
      });
    }

    let errorMessage: string | null = null;
    const verified = await this._provider
      .verify(verificationSid, code)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verified });
  }
}
