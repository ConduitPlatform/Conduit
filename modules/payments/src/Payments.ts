import PaymentsConfigSchema from './config';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitServiceModule,
  GrpcServer,
  SetConfigRequest,
  SetConfigResponse,
  wrapCallbackFunctionForRouter,
  wrapCallObjectForRouter,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';
import { status } from '@grpc/grpc-js';
import { PaymentsRoutes } from './routes/Routes';
import * as models from './models';
import { AdminHandlers } from './admin/admin';
import { IamportHandlers } from './handlers/iamport';
import { StripeHandlers } from './handlers/stripe';
import {
  CancelStripePaymentRequest,
  CancelStripePaymentResponse,
  CompleteIamportPaymentRequest,
  CompleteIamportPaymentResponse,
  CreateIamportPaymentRequest,
  CreateIamportPaymentResponse,
  CreateStripePaymentRequest,
  CreateStripePaymentResponse,
  RefundStripePaymentRequest,
  RefundStripePaymentResponse,
} from './types';

export default class PaymentsModule implements ConduitServiceModule {
  private database: any;
  private _admin: AdminHandlers;
  private isRunning: boolean = false;
  private grpcServer: GrpcServer;
  private _router: PaymentsRoutes;
  private iamportHandlers: IamportHandlers | null;
  private stripeHandlers: StripeHandlers | null;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private _port: string;

  get port(): string {
    return this._port;
  }

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    await this.grpcServer.addService(
      path.resolve(__dirname, './payments.proto'),
      'payments.Payments',
      {
        setConfig: this.setConfig.bind(this),
        createIamportPayment: this.createIamportPayment.bind(this),
        completeIamportPayment: this.completeIamportPayment.bind(this),
        createStripePayment: this.createStripePayment.bind(this),
        cancelStripePayment: this.cancelStripePayment.bind(this),
        refundStripePayment: this.refundStripePayment.bind(this),
      }
    );
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
    this.grpcSdk.bus?.subscribe('payments', (message: string) => {
      if (message === 'config-update') {
        this.enableModule()
          .then(() => {
            console.log('Updated payments configuration');
          })
          .catch(() => {
            console.log('Failed to update payments config');
          });
      }
    });
    try {
      await this.grpcSdk.config.get('payments');
    } catch (e) {
      await this.grpcSdk.config.updateConfig(
        PaymentsConfigSchema.getProperties(),
        'payments'
      );
    }
    let paymentsConfig = await this.grpcSdk.config.addFieldstoConfig(
      PaymentsConfigSchema.getProperties(),
      'payments'
    );
    if (paymentsConfig.active) await this.enableModule();
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
      PaymentsConfigSchema.load(newConfig).validate();
    } catch (e) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid configuration given',
      });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, 'payments')
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const paymentsConfig = await this.grpcSdk.config.get('payments');
    if (paymentsConfig.active) {
      await this.enableModule().catch((e: Error) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish('payments', 'config-update');
    } else {
      return callback({ code: status.INTERNAL, message: 'Module is not active' });
    }
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updatedConfig: JSON.stringify(updateResult) });
  }

  async createIamportPayment(
    call: CreateIamportPaymentRequest,
    callback: CreateIamportPaymentResponse
  ) {
    const productId = call.request.productId;
    const quantity = call.request.quantity;
    const userId = call.request.userId === '' ? undefined : call.request.userId;

    if (isNil(this.iamportHandlers)) {
      return callback({ code: status.INTERNAL, message: 'Iamport is deactivated' });
    }

    try {
      const res = await this.iamportHandlers.createPayment(productId, quantity, userId);

      return callback(null, res);
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }
  }

  async completeIamportPayment(
    call: CompleteIamportPaymentRequest,
    callback: CompleteIamportPaymentResponse
  ) {
    const imp_uid = call.request.imp_uid;
    const merchant_uid = call.request.merchant_uid;

    if (isNil(this.iamportHandlers)) {
      return callback({ code: status.INTERNAL, message: 'Iamport is deactivated' });
    }

    if (isNil(imp_uid) || isNil(merchant_uid) || imp_uid === '' || merchant_uid === '') {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'imp_uid and merchant_uid are required',
      });
    }

    try {
      const success = await this.iamportHandlers.completePayment(imp_uid, merchant_uid);
      return callback(null, { success });
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }
  }

  async createStripePayment(
    call: CreateStripePaymentRequest,
    callback: CreateStripePaymentResponse
  ) {
    if (isNil(this.stripeHandlers)) {
      return callback({ code: status.INTERNAL, message: 'Stripe is deactivated' });
    }

    await this.stripeHandlers.createPayment(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  async cancelStripePayment(
    call: CancelStripePaymentRequest,
    callback: CancelStripePaymentResponse
  ) {
    if (isNil(this.stripeHandlers)) {
      return callback({ code: status.INTERNAL, message: 'Stripe is deactivated' });
    }

    await this.stripeHandlers.cancelPayment(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  async refundStripePayment(
    call: RefundStripePaymentRequest,
    callback: RefundStripePaymentResponse
  ) {
    if (isNil(this.stripeHandlers)) {
      return callback({ code: status.INTERNAL, message: 'Stripe is deactivated' });
    }

    await this.stripeHandlers.refundPayment(
      wrapCallObjectForRouter(call),
      wrapCallbackFunctionForRouter(callback)
    );
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider;
      this._router = new PaymentsRoutes(this.grpcServer, this.grpcSdk);
      this.stripeHandlers = await this._router.getStripe();
      this.iamportHandlers = await this._router.getIamport();
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk, this.stripeHandlers);
      await this.registerSchemas();
      this.isRunning = true;
    }
    await this._router.registerRoutes();
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      return this.database.createSchemaFromAdapter(model);
    });
    return Promise.all(promises);
  }
}
