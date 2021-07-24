import { ISmsProvider } from './interfaces/ISmsProvider';
import { TwilioProvider } from './providers/twilio';
import SmsConfigSchema from './config';
import { AdminHandlers } from './admin/admin';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitServiceModule,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import { status } from '@grpc/grpc-js';
import {
  SendSmsRequest,
  SendSmsResponse,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  VerifyRequest,
  VerifyResponse,
} from './types';

export default class SmsModule implements ConduitServiceModule {
  private _provider: ISmsProvider | undefined;
  private adminHandlers: AdminHandlers;
  private isRunning: boolean = false;
  private grpcServer: GrpcServer;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private _port: string;

  get port(): string {
    return this._port;
  }

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_PORT);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(path.resolve(__dirname, './sms.proto'), 'sms.Sms', {
      setConfig: this.setConfig.bind(this),
      sendSms: this.sendSms.bind(this),
      sendVerificationCode: this.sendVerificationCode.bind(this),
      verify: this.verify.bind(this),
    });
    this.grpcServer.start();
    console.log('Grpc server is online');

    this.adminHandlers = new AdminHandlers(this.grpcServer, this.grpcSdk, this._provider);
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus?.subscribe('sms', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated sms configuration');
          })
          .catch(() => {
            console.log('Failed to update email config');
          });
      }
    });
    try {
      await this.grpcSdk.config.get('sms');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(SmsConfigSchema.getProperties(), 'sms');
    }
    let smsConfig = await this.grpcSdk.config.addFieldstoConfig(
      SmsConfigSchema.getProperties(),
      'sms'
    );
    if (smsConfig.active) await this.enableModule();
  }

  async setConfig(call: SetConfigRequest, callback: SetConfigResponse) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (
      isNil(newConfig.active) ||
      isNil(newConfig.providerName) ||
      isNil(newConfig[newConfig.providerName])
    ) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration given',
      });
    }
    try {
      SmsConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration given',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'sms')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const smsConfig = await this.grpcSdk.config.get('sms');
    if (smsConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('sms', 'config-update');
    } else {
      return callback({ code: status.INTERNAL, message: 'Module is not active' });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  async sendSms(call: SendSmsRequest, callback: SendSmsResponse) {
    const to = call.request.to;
    const message = call.request.message;
    let errorMessage: string | null = null;

    if (isNil(this._provider)) {
      return callback({ code: status.INTERNAL, message: 'No sms provider' });
    }

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

    let verificationSid = await this._provider
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

    let verified = await this._provider
      .verify(verificationSid, code)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verified });
  }

  private async enableModule() {
    await this.initProvider();
    this.adminHandlers.updateProvider(this._provider!);
    this.isRunning = true;
  }

  private async initProvider() {
    const smsConfig = await this.grpcSdk.config.get('sms');
    const name = smsConfig.providerName;
    const settings = smsConfig[name];

    if (name === 'twilio') {
      this._provider = new TwilioProvider(settings);
    } else {
      console.error('SMS provider not supported');
      process.exit(-1);
    }
  }
}
