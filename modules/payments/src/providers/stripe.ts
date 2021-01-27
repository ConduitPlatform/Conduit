import { IPaymentProvider } from '../interfaces/IPaymentProvider';
import Stripe from 'stripe';
import { isNil } from 'lodash';
import ConduitGrpcSdk from "@quintessential-sft/conduit-grpc-sdk";

const PROVIDER_NAME = 'stripe';

export class StripeProvider implements IPaymentProvider {
  private readonly api_key: string;
  private client: Stripe;

  constructor(api_key: string, private readonly grpcSdk: ConduitGrpcSdk, private readonly database: any) {
    this.api_key = api_key;
    this.client = new Stripe(this.api_key, {
      apiVersion: "2020-08-27"
    });
  }

  async createPayment(
    productName: string,
    currency: string,
    unitAmount: number,
    userId?: string,
    saveCard?: boolean
  ): Promise<any> {
    let errorMessage: string | null = null;
    let customerId;

    if (!isNil(userId)) {
      const customerDb = await this.database.findOne('PaymentsCustomer', { userId, provider: PROVIDER_NAME })
        .catch((e: Error) => {
          errorMessage = e.message;
        });
      if (!isNil(errorMessage)) {
        return Promise.reject(errorMessage);
      }
      if (isNil(customerDb)) {
        const customer = await this.client.customers.create({
          metadata: {
            userId: userId
          }
        });
        customerId = customer.id;
        await this.database.create('PaymentsCustomer', {
          customerId: customerId,
          userId,
          provider: PROVIDER_NAME
        })
      } else {
        customerId = customerDb.customerId;
      }
    }

    const intent = await this.client.paymentIntents.create({
      amount: unitAmount,
      currency,
      metadata: {
        product: productName,
        userId: isNil(userId) ? null : userId,
        saveCard: saveCard ? 'true' : 'false'
      },
      customer: customerId,
      setup_future_usage: saveCard ? 'off_session' : 'on_session'
    });

    await this.database.create('Transaction', {
      userId,
      provider: PROVIDER_NAME,
      data: intent
    });

    return Promise.resolve({ clientSecret: intent.client_secret, paymentId: intent.id });
  }

  async createPaymentWithSavedCard(
    productName: string,
    currency: string,
    unitAmount: number,
    userId: string,
    cardId: string
  ): Promise<any> {
    let errorMessage: string | null = null;
    const customer = await this.database.findOne('PaymentsCustomer', { userId, provider: PROVIDER_NAME })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return Promise.reject(errorMessage);
    }
    if (isNil(customer)) {
      return Promise.reject('customer not found');
    }

    let res: any = {}

    try {
      const intent = await this.client.paymentIntents.create({
        amount: unitAmount,
        currency,
        metadata: {
          product: productName,
          userId: isNil(userId) ? null : userId,
        },
        customer: customer.customerId,
        payment_method: cardId,
        off_session: true,
        confirm: true
      });

      await this.database.create('Transaction', {
        userId,
        provider: PROVIDER_NAME,
        data: intent
      });

      res.clientSecret = intent.client_secret;
      res.paymentId = intent.id;
    } catch (err) {
      if (err.code === 'authentication_required') {
        res.error = err.code;
        res.paymentMethod = err.raw.payment_method.id;
        res.clientSecret = err.raw.payment_intent.client_secret;
      }
    }

    return Promise.resolve(res);
  }

  async cancelPayment(paymentId: string, userId?: string): Promise<boolean> {
    let errorMessage: string | null = null;
    const intent = await this.client.paymentIntents.cancel(paymentId)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return Promise.reject(errorMessage);
    }

    await this.database.create('Transaction', {
      userId,
      provider: PROVIDER_NAME,
      data: intent
    });

    return Promise.resolve(true)
  }

  async refundPayment(paymentId: string, userId?: string): Promise<boolean> {
    let errorMessage: string | null = null;
    const intent = await this.client.refunds.create({
      payment_intent: paymentId,
      metadata: {
        userId: isNil(userId) ? null : userId
      }
    }).catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return Promise.reject(errorMessage);
    }

    await this.database.create('Transaction', {
      userId,
      provider: PROVIDER_NAME,
      data: intent
    })

    return Promise.resolve(true);
  }

  async getPaymentMethods(userId: string): Promise<any> {
    let errorMessage: string | null = null;
    const customer = await this.database.findOne('PaymentsCustomer', {
      userId,
      provider: PROVIDER_NAME
    }).catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return Promise.reject("customer not found");
    }

    const paymentMethods = await this.client.paymentMethods.list({
      customer: customer.customerId,
      type: 'card'
    });

    return Promise.resolve(paymentMethods);
  }
}