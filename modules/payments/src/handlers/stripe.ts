import Stripe from 'stripe';
import { isNil } from 'lodash';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ConduitError } from '@quintessential-sft/conduit-sdk';
import * as grpc from 'grpc';

const PROVIDER_NAME = 'stripe';

export class StripeHandlers {
  private client: Stripe;
  private initialized: boolean = false;
  private database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.validate()
      .then(() => {
        return this.initDb();
      })
      .catch((e: Error) => {
        console.log('Stripe not active');
      });
  }

  async validate(): Promise<Boolean> {
    return this.grpcSdk.config
      .get('payments')
      .then((paymentsConfig: any) => {
        if (!paymentsConfig.stripe.enabled) {
          throw ConduitError.forbidden('Stripe is deactivated');
        }
        if (!paymentsConfig.stripe || !paymentsConfig.stripe.secret_key) {
          throw ConduitError.forbidden('Cannot enable stripe due to missing api key');
        }
        this.client = new Stripe(paymentsConfig.stripe.secret_key, {
          apiVersion: '2020-08-27',
        });
      })
      .then(() => {
        if (!this.initialized) {
          return this.initDb();
        }
      })
      .then((r: any) => {
        return true;
      })
      .catch((e: Error) => {
        this.initialized = false;
        throw e;
      });
  }

  private async initDb() {
    await this.grpcSdk.waitForExistence('database-provider');
    this.database = this.grpcSdk.databaseProvider;
    this.initialized = true;
  }

  async createPayment(call: any, callback: any) {
    const { productId, userId, saveCard } = JSON.parse(call.request.params);
    let errorMessage: string | null = null;
    let customerId;

    if (isNil(productId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'productId is required',
      });
    }

    const product = await this.database
      .findOne('Product', { _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(product)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'product not found',
      });
    }

    if (!isNil(userId)) {
      const customerDb = await this.database
        .findOne('PaymentsCustomer', { userId })
        .catch((e: Error) => {
          errorMessage = e.message;
        });
      if (!isNil(errorMessage)) {
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }
      if (isNil(customerDb) || isNil(customerDb.stripe)) {
        const customer = await this.client.customers.create({
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
        await this.database.create('PaymentsCustomer', {
          stripe: {
            customerId,
          },
          userId,
        });
      } else {
        customerId = customerDb.stripe.customerId;
      }
    }

    let options: Stripe.PaymentIntentCreateParams = {
      amount: product.value,
      currency: product.currency,
      metadata: {
        product: product.name,
        userId: isNil(userId) ? null : userId,
        saveCard: saveCard ? 'true' : 'false',
      },
      customer: customerId,
    };

    if (!isNil(userId) && saveCard) {
      options.setup_future_usage = 'off_session';
    }

    const intent = await this.client.paymentIntents.create(options);

    await this.database
      .create('Transaction', {
        userId,
        provider: PROVIDER_NAME,
        product: productId,
        data: intent,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, {
      result: JSON.stringify({
        clientSecret: intent.client_secret,
        paymentId: intent.id,
      }),
    });
  }

  async createPaymentWithSavedCard(call: any, callback: any) {
    const { productId, cardId } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    if (isNil(productId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'productId is required',
      });
    }

    let errorMessage: string | null = null;

    const product = await this.database
      .findOne('Product', { _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(product)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'product not found',
      });
    }

    const customer = await this.database
      .findOne('PaymentsCustomer', { userId: context.user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(customer) || isNil(customer.stripe)) {
      return callback({ code: grpc.status.INTERNAL, message: 'customer not found' });
    }

    let res: any = {};

    try {
      const intent = await this.client.paymentIntents.create({
        amount: product.value,
        currency: product.currency,
        metadata: {
          product: product.name,
          userId: context.user._id,
        },
        customer: customer.stripe.customerId,
        payment_method: cardId,
        off_session: true,
        confirm: true,
      });

      await this.database
        .create('Transaction', {
          userId: context.user._id,
          provider: PROVIDER_NAME,
          product: productId,
          data: intent,
        })
        .catch((e: Error) => {
          errorMessage = e.message;
        });
      if (!isNil(errorMessage)) {
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }

      res.clientSecret = intent.client_secret;
      res.paymentId = intent.id;
    } catch (err) {
      if (err.code === 'authentication_required') {
        res.error = err.code;
        res.paymentMethod = err.raw.payment_method.id;
        res.clientSecret = err.raw.payment_intent.client_secret;
      }
    }

    return callback(null, { result: JSON.stringify(res) });
  }

  async cancelPayment(call: any, callback: any) {
    // TODO maybe check if user is the same as the one that created the payment
    const { paymentId, userId } = JSON.parse(call.request.params);
    let errorMessage: string | null = null;
    const intent = await this.client.paymentIntents
      .cancel(paymentId)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    await this.database
      .create('Transaction', {
        userId,
        provider: PROVIDER_NAME,
        data: intent,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: 'true' });
  }

  async refundPayment(call: any, callback: any) {
    // TODO maybe check if user is the same as the one that created the payment
    const { paymentId, userId } = JSON.parse(call.request.params);

    if (isNil(paymentId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'paymentId is required',
      });
    }

    let errorMessage: string | null = null;
    const intent = await this.client.refunds
      .create({
        payment_intent: paymentId,
        metadata: {
          userId: isNil(userId) ? null : userId,
        },
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    await this.database
      .create('Transaction', {
        userId,
        provider: PROVIDER_NAME,
        data: intent,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: 'true' });
  }

  async getPaymentMethods(call: any, callback: any): Promise<any> {
    let errorMessage: string | null = null;
    const context = JSON.parse(call.request.context);
    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }
    const customer = await this.database
      .findOne('PaymentsCustomer', { userId: context.user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: 'customer not found' });
    }

    if (isNil(customer) || isNil(customer.stripe)) {
      return callback({ code: grpc.status.INTERNAL, message: 'customer not found' });
    }

    const paymentMethods = await this.client.paymentMethods.list({
      customer: customer.stripe.customerId,
      type: 'card',
    });

    return callback(null, { result: JSON.stringify({ paymentMethods }) });
  }

  async completePayment(call: any, callback: any) {
    const data = JSON.parse(call.request.params);
    let userId = data.data.object.metadata?.userId;

    let errorMessage: string | null = null;
    await this.database
      .create('Transaction', {
        userId,
        provider: PROVIDER_NAME,
        data,
      })
      .catch((e: Error) => {
        console.error(e);
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }
    return callback(null, { result: JSON.stringify('ok') });
  }

  async createSubscriptionProduct(
    name: string,
    currency: string,
    unitAmount: number,
    recurring: 'day' | 'week' | 'month' | 'year',
    recurringCount?: number
  ): Promise<any> {
    const product = await this.client.products.create({
      name,
    });

    const price = await this.client.prices.create({
      product: product.id,
      currency,
      unit_amount: unitAmount,
      recurring: {
        interval: recurring,
        interval_count: recurringCount || 1,
      },
    });

    return Promise.resolve({ subscriptionId: product.id, priceId: price.id });
  }
}
