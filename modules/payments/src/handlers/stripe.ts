import Stripe from 'stripe';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  RouterRequest,
  RouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  PaymentsCustomer,
  Product,
  Transaction,
} from '../models';

const PROVIDER_NAME = 'stripe';

export class StripeHandlers {
  private client: Stripe;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.validate()
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
        return true;
      })
      .catch((e: Error) => {
        throw e;
      });
  }

  async createPayment(call: RouterRequest, callback: RouterResponse) {
    const { productId, userId, saveCard } = JSON.parse(call.request.params);
    let errorMessage: string | null = null;
    let customerId;

    if (isNil(productId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'productId is required',
      });
    }

    const product = await Product.getInstance()
      .findOne({ _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    if (isNil(product)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'product not found',
      });
    }

    if (!isNil(userId)) {
      const customerDb = await PaymentsCustomer.getInstance()
        .findOne({ userId })
        .catch((e: Error) => {
          errorMessage = e.message;
        });
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
      }
      if (isNil(customerDb) || isNil((customerDb as PaymentsCustomer).stripe)) {
        const customer = await this.client.customers.create({
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;
        await PaymentsCustomer.getInstance()
          .create({
            stripe: {
              customerId,
            },
            userId
          });
      } else {
        customerId = (customerDb as PaymentsCustomer).stripe.customerId;
      }
    }

    let options: Stripe.PaymentIntentCreateParams = {
      amount: (product as Product).value,
      currency: (product as Product).currency,
      metadata: {
        product: (product as Product).name,
        userId: isNil(userId) ? null : userId,
        saveCard: saveCard ? 'true' : 'false',
      },
      customer: customerId,
    };

    if (!isNil(userId) && saveCard) {
      options.setup_future_usage = 'off_session';
    }

    const intent = await this.client.paymentIntents.create(options);

    await Transaction.getInstance()
      .create({
        customerId,
        provider: PROVIDER_NAME,
        product: productId,
        data: intent,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish(
      'payments:createStripe:Transaction',
      JSON.stringify({ userId, productId, amount: (product as Product).value })
    );

    return callback(null, {
      result: JSON.stringify({
        clientSecret: intent.client_secret,
        paymentId: intent.id,
      }),
    });
  }

  async createPaymentWithSavedCard(call: RouterRequest, callback: RouterResponse) {
    const { productId, cardId } = JSON.parse(call.request.params);
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    if (isNil(productId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'productId is required',
      });
    }

    let errorMessage: string | null = null;

    const product = await Product.getInstance()
      .findOne({ _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    if (isNil(product)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'product not found',
      });
    }

    const customer = await PaymentsCustomer.getInstance()
      .findOne({ userId: context.user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }
    if (isNil(customer) || isNil((customer as PaymentsCustomer).stripe)) {
      return callback({ code: status.INTERNAL, message: 'customer not found' });
    }

    let res: any = {};

    try {
      const intent = await this.client.paymentIntents.create({
        amount: (product as Product).value,
        currency: (product as Product).currency,
        metadata: {
          product: (product as Product).name,
          userId: context.user._id,
        },
        customer: (customer as PaymentsCustomer).stripe.customerId,
        payment_method: cardId,
        off_session: true,
        confirm: true,
      });

      await Transaction.getInstance()
        .create({
          userId: context.user._id,
          provider: PROVIDER_NAME,
          product: productId,
          data: intent,
        })
        .catch((e: Error) => {
          errorMessage = e.message;
        });
      if (!isNil(errorMessage)) {
        return callback({ code: status.INTERNAL, message: errorMessage });
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

    this.grpcSdk.bus?.publish(
      'payments:create:Transaction',
      JSON.stringify({ userId: context.user._id, productId, amount: (product as Product).value })
    );

    return callback(null, { result: JSON.stringify(res) });
  }

  async cancelPayment(call: RouterRequest, callback: RouterResponse) {
    // TODO maybe check if user is the same as the one that created the payment
    const { paymentId, userId } = JSON.parse(call.request.params);
    let errorMessage: string | null = null;

    const intent = await this.client.paymentIntents
      .cancel(paymentId)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    await Transaction.getInstance()
      .create({
        userId,
        provider: PROVIDER_NAME,
        data: intent,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish(
      'publish:cancel:Transaction',
      JSON.stringify({ userId, paymentId })
    );
    return callback(null, { result: JSON.stringify({ success: true }) });
  }

  async refundPayment(call: RouterRequest, callback: RouterResponse) {
    // TODO maybe check if user is the same as the one that created the payment
    const { paymentId, userId } = JSON.parse(call.request.params);

    if (isNil(paymentId)) {
      return callback({
        code: status.INVALID_ARGUMENT,
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
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    await Transaction.getInstance()
      .create({
        userId,
        provider: PROVIDER_NAME,
        data: intent,
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    this.grpcSdk.bus?.publish(
      'publish:refund:Transaction',
      JSON.stringify({ userId, paymentId })
    );
    return callback(null, { result: JSON.stringify({ success: true }) });
  }

  async getPaymentMethods(call: RouterRequest, callback: RouterResponse) {
    let errorMessage: string | null = null;
    const context = JSON.parse(call.request.context);
    if (isNil(context)) {
      return callback({
        code: status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }
    const customer = await PaymentsCustomer.getInstance()
      .findOne({ userId: context.user._id })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: 'customer not found' });
    }

    if (isNil(customer) || isNil((customer as PaymentsCustomer).stripe)) {
      return callback({ code: status.INTERNAL, message: 'customer not found' });
    }

    const paymentMethods = await this.client.paymentMethods.list({
      customer: (customer as PaymentsCustomer).stripe.customerId,
      type: 'card',
    });

    return callback(null, { result: JSON.stringify({ paymentMethods }) });
  }

  async completePayment(call: RouterRequest, callback: RouterResponse) {
    const data = JSON.parse(call.request.params);
    let userId = data.data.object.metadata?.userId;

    let errorMessage: string | null = null;
    await Transaction.getInstance()
      .create({
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
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    this.grpcSdk.bus?.publish(
      'payments:paidStripe:Transaction',
      JSON.stringify({ userId })
    );
    return callback(null, { result: JSON.stringify('ok') });
  }

  async createSubscriptionProduct(
    name: string,
    currency: string,
    unitAmount: number,
    recurring: 'day' | 'week' | 'month' | 'year',
    recurringCount?: number
  ): Promise<{ subscriptionId: string; priceId: string }> {
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
