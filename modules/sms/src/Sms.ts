import ConduitGrpcSdk, {
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import AppConfigSchema, { Config } from './config';
import { AdminHandlers } from './admin';
import { ISmsProvider } from './interfaces/ISmsProvider';
import { TwilioProvider } from './providers/twilio';
import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import {
  SendSmsRequest,
  SendSmsResponse,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  VerifyRequest,
  VerifyResponse,
} from './protoTypes/sms';
import metricsSchema from './metrics';
import { ConfigController, ManagedModule } from '@conduitplatform/module-tools';

export default class Sms extends ManagedModule<Config> {
  configSchema = AppConfigSchema;
  service = {
    protoPath: path.resolve(__dirname, 'sms.proto'),
    protoDescription: 'sms.Sms',
    functions: {
      sendSms: this.sendSms.bind(this),
      sendVerificationCode: this.sendVerificationCode.bind(this),
      verify: this.verify.bind(this),
    },
  };
  protected metricsSchema = metricsSchema;
  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private _provider: ISmsProvider | undefined;

  constructor() {
    super('sms');
    this.updateHealth(HealthCheckStatus.UNKNOWN, true);
  }

  async onServerStart() {
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
    if (!ConfigController.getInstance().config.active) {
      this.updateHealth(HealthCheckStatus.NOT_SERVING);
    } else {
      await this.initProvider();
    }
  }

  async initializeMetrics() {}

  // gRPC Service
  async sendSms(
    call: GrpcRequest<SendSmsRequest>,
    callback: GrpcCallback<SendSmsResponse>,
  ) {
    const to = call.request.to;
    const message = call.request.message;
    if (isNil(this._provider)) {
      return callback({ code: status.INTERNAL, message: 'No sms provider' });
    }

    let errorMessage: string | null = null;
    await this._provider.sendSms(to, message).catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { message: 'SMS sent' });
  }

  async sendVerificationCode(
    call: GrpcRequest<SendVerificationCodeRequest>,
    callback: GrpcCallback<SendVerificationCodeResponse>,
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
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verificationSid });
  }

  async verify(call: GrpcRequest<VerifyRequest>, callback: GrpcCallback<VerifyResponse>) {
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
      .catch(e => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { verified });
  }

  private async initProvider() {
    const smsConfig = ConfigController.getInstance().config;
    const name = smsConfig.providerName;
    const settings = smsConfig[name];

    if (name === 'twilio') {
      try {
        this._provider = new TwilioProvider(settings);
      } catch (e) {
        this._provider = undefined;
        ConduitGrpcSdk.Logger.error(e as Error);
        return;
      }
    } else {
      ConduitGrpcSdk.Logger.error('SMS provider not supported');
      return;
    }
    this.adminRouter.updateProvider(this._provider!);
    this.isRunning = true;
    this.updateHealth(
      this._provider ? HealthCheckStatus.SERVING : HealthCheckStatus.NOT_SERVING,
    );
  }
}
