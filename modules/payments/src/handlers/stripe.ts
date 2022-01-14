import Stripe from 'stripe';
import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
} from '@quintessential-sft/conduit-grpc-sdk';
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
      .catch(() => {
        console.error('Stripe not active');
      });
  }

  async validate(): Promise<Boolean> {
    return this.grpcSdk.config
      .get('payments')
      .then((paymentsConfig: any) => {
        if (!paymentsConfig.stripe.enabled) {
          throw new GrpcError(status.FAILED_PRECONDITION, 'Stripe is deactivated');
        }
        if (!paymentsConfig.stripe || !paymentsConfig.stripe.secret_key) {
          throw new GrpcError(status.FAILED_PRECONDITION, 'Cannot enable stripe due to missing api key');
        }
        this.client = new Stripe(paymentsConfig.stripe.secret_key, {
          apiVersion: '2020-08-27',
        });
      })
      .then(() => {
        return true;
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  }

  async createPayment(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { productId, userId, saveCard } = call.request.params;
    if (isNil(productId)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'productId is required');
    }
    const product = await Product.getInstance()
      .findOne({ _id: productId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (!product) {
      throw new GrpcError(status.NOT_FOUND, 'Product does not exist');
    }

    let customerId;
    if (!isNil(userId)) {
      const customerDb = await PaymentsCustomer.getInstance()
        .findOne({ userId })
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
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
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.grpcSdk.bus?.publish(
      'payments:createStripe:Transaction',
      JSON.stringify({ userId, productId, amount: (product as Product).value })
    );

    return {
      clientSecret: intent.client_secret,
      paymentId: intent.id,
    };
  }

  async createPaymentWithSavedCard(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { productId, cardId } = call.request.params;
    const context = call.request.context;
    if (isNil(context)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    }
    if (isNil(productId)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'productId is required');
    }
    const product = await Product.getInstance()
      .findOne({ _id: productId })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (!product) {
      throw new GrpcError(status.NOT_FOUND, 'Product does not exist');
    }
    const customer = await PaymentsCustomer.getInstance()
      .findOne({ userId: context.user._id })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (!customer || isNil((customer as PaymentsCustomer).stripe)) {
      throw new GrpcError(status.NOT_FOUND, 'Customer does not exist');
    }

    const intent = await this.client.paymentIntents
      .create({
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
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    await Transaction.getInstance()
      .create({
        userId: context.user._id,
        provider: PROVIDER_NAME,
        product: productId,
        data: intent,
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.grpcSdk.bus?.publish(
      'payments:create:Transaction',
      JSON.stringify({ userId: context.user._id, productId, amount: (product as Product).value })
    );
    return {
      clientSecret: intent.client_secret,
      paymentId: intent.id,
      paymentMethod: intent.payment_method,
    };
  }

  async cancelPayment(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    // TODO maybe check if user is the same as the one that created the payment
    const { paymentId, userId } = call.request.params;

    const intent = await this.client.paymentIntents
      .cancel(paymentId)
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    await Transaction.getInstance()
      .create({
        userId,
        provider: PROVIDER_NAME,
        data: intent,
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.grpcSdk.bus?.publish(
      'publish:cancel:Transaction',
      JSON.stringify({ userId, paymentId })
    );
    return { success: true };
  }

  async refundPayment(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    // TODO maybe check if user is the same as the one that created the payment
    const { paymentId, userId } = call.request.params;
    if (isNil(paymentId)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'productId is required');
    }

    const intent = await this.client.refunds
      .create({
        payment_intent: paymentId,
        metadata: {
          userId: isNil(userId) ? null : userId,
        },
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    await Transaction.getInstance()
      .create({
        userId,
        provider: PROVIDER_NAME,
        data: intent,
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.grpcSdk.bus?.publish(
      'publish:refund:Transaction',
      JSON.stringify({ userId, paymentId })
    );
    return { success: true };
  }

  async getPaymentMethods(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    }
    const customer = await PaymentsCustomer.getInstance()
      .findOne({ userId: context.user._id })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (isNil(customer) || isNil((customer as PaymentsCustomer).stripe)) {
      throw new GrpcError(status.NOT_FOUND, 'Customer does not exist');
    }
    const paymentMethods = await this.client.paymentMethods.list({
      customer: (customer as PaymentsCustomer).stripe.customerId,
      type: 'card',
    });
    return { paymentMethods };
  }

  async completePayment(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const data = call.request.params;
    let userId = data.data.object.metadata?.userId;
    await Transaction.getInstance()
      .create({
        userId,
        provider: PROVIDER_NAME,
        data,
      })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    this.grpcSdk.bus?.publish(
      'payments:paidStripe:Transaction',
      JSON.stringify({ userId })
    );
    return 'Ok';
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
