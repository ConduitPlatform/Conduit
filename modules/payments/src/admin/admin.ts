import ConduitGrpcSdk, { GrpcServer } from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { isNil } from 'lodash';
import { StripeHandlers } from '../handlers/stripe';

let paths = require('./admin.json').functions;
export class AdminHandlers {
  private database: any;

  constructor(
    server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly stripeHandlers: StripeHandlers | null
  ) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });

    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        createProduct: this.createProduct.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async createProduct(call: any, callback: any) {
    const {
      name,
      value,
      currency,
      isSubscription,
      recurring,
      recurringCount,
    } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(value) || isNil(currency)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'product name, value and currency are required',
      });
    }

    let errorMessage: string | null = null;

    let productDoc: any = {
      name,
      value,
      currency,
      isSubscription,
      recurring,
      recurringCount,
    };

    if (isSubscription) {
      if (isNil(recurring)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'recurring is required for subscription products',
        });
      }
      if (
        recurring !== 'day' &&
        recurring !== 'week' &&
        recurring !== 'month' &&
        recurring !== 'year'
      ) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'recurring must be one of [day, week, month, year]',
        });
      }

      if (!isNil(this.stripeHandlers)) {
        const res = await this.stripeHandlers
          .createSubscriptionProduct(name, currency, value, recurring, recurringCount)
          .catch((e: Error) => {
            errorMessage = e.message;
          });
        if (!isNil(errorMessage)) {
          return callback({ code: grpc.status.INTERNAL, message: errorMessage });
        }
        productDoc.stripe = {};
        productDoc.stripe.subscriptionId = res.subscriptionId;
        productDoc.stripe.priceId = res.priceId;
      }
    }

    const product = await this.database
      .create('Product', productDoc)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }

    return callback(null, { result: JSON.stringify({ ...product }) });
  }
}
