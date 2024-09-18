import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import { AdminHandlers } from './admin/index.js';
import { ISmsProvider } from './interfaces/ISmsProvider.js';
import { TwilioProvider } from './providers/twilio.js';
import { AwsSnsProvider } from './providers/awsSns.js';
import { messageBirdProvider } from './providers/messageBird.js';
import { clickSendProvider } from './providers/clickSend.js';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { ConfigController, RoutingManager } from '@conduitplatform/module-tools';
import { CommService } from '../../interfaces/CommService.js';
import {
  SendSmsRequest,
  SendSmsResponse,
  SendVerificationCodeRequest,
  SendVerificationCodeResponse,
  VerifyRequest,
  VerifyResponse,
} from '../../protoTypes/comms.js';

export default class Sms implements CommService {
  readonly functions = {
    sendSms: this.sendSms.bind(this),
    sendVerificationCode: this.sendVerificationCode.bind(this),
    verify: this.verify.bind(this),
  };

  private isRunning: boolean = false;
  private adminRouter: AdminHandlers;
  private _provider: ISmsProvider | undefined;
  private static _instance: Sms;
  private _health: HealthCheckStatus = HealthCheckStatus.UNKNOWN;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (!Sms._instance) {
      if (!grpcSdk) throw new Error('GrpcSdk must be provided');
      Sms._instance = new Sms(grpcSdk);
    }
    return Sms._instance;
  }

  async preConfig(config: any) {
    if (
      isNil(config.sms.active) ||
      isNil(config.sms.providerName) ||
      isNil(config.sms[config.sms.providerName])
    ) {
      throw new Error('Invalid configuration given');
    }
    return config;
  }

  async onConfig() {
    if (!ConfigController.getInstance().config.sms.active) {
      this._health = HealthCheckStatus.NOT_SERVING;
    } else {
      this.adminRouter = new AdminHandlers(this.grpcSdk, this._provider);
      await this.initProvider();
    }
  }

  registerAdminRoutes(routingManager: RoutingManager) {
    this.adminRouter.registerAdminRoutes(routingManager);
  }

  get rpcFunctions() {
    return this.functions;
  }

  get health() {
    return this._health;
  }

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
    try {
      switch (name) {
        case 'twilio':
          this._provider = new TwilioProvider(settings);
          break;
        case 'awsSns':
          this._provider = new AwsSnsProvider(settings, this.grpcSdk);
          break;
        case 'messageBird':
          this._provider = new messageBirdProvider(settings);
          break;
        case 'clickSend':
          this._provider = new clickSendProvider(settings, this.grpcSdk);
          break;
        default:
          ConduitGrpcSdk.Logger.error('SMS provider not supported');
          return;
      }
    } catch (e) {
      this._provider = undefined;
      ConduitGrpcSdk.Logger.error(e as Error);
      return;
    }

    this.adminRouter.updateProvider(this._provider!);
    this.isRunning = true;
    this._health = this._provider
      ? HealthCheckStatus.SERVING
      : HealthCheckStatus.NOT_SERVING;
  }
}
