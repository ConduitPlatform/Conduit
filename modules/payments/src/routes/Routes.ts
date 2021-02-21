import * as grpc from 'grpc';
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructRoute,
  GrpcServer,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { StripeHandlers } from '../handlers/stripe';
import { IamportHandlers } from '../handlers/iamport';

export class PaymentsRoutes {
  private database: any;
  private readonly stripeHandlers: StripeHandlers;
  private readonly iamportHandlers: IamportHandlers;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.stripeHandlers = new StripeHandlers(grpcSdk);
    this.iamportHandlers = new IamportHandlers(grpcSdk);
    const self = this;

    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
  }

  async getStripe(): Promise<StripeHandlers | null> {
    let errorMessage = null;
    let paymentsActive = await this.stripeHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && paymentsActive) {
      return Promise.resolve(this.stripeHandlers);
    }
    return Promise.resolve(null);
  }

  async getIamport(): Promise<IamportHandlers | null> {
    let errorMessage = null;
    let paymentsActive = await this.iamportHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && paymentsActive) {
      return Promise.resolve(this.iamportHandlers);
    }
    return Promise.resolve(null);
  }

  async getProducts(call: any, callback: any) {
    let errorMessage: string | null = null;
    const products = await this.database.findMany('Product', {}).catch((e: Error) => {
      errorMessage = e.message;
    });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }

    return callback(null, { result: JSON.stringify({ products }) });
  }

  async getSubscriptions(call: any, callback: any) {
    const context = JSON.parse(call.request.context);

    if (isNil(context)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });
    }

    let errorMessage: string | null = null;

    const subscriptions = await this.database
      .findMany(
        'Subscription',
        {
          userId: context.user._id,
          activeUntil: { $gte: new Date() },
        },
        null,
        null,
        null,
        null,
        'product'
      )
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { result: JSON.stringify({ subscriptions }) });
  }

  async createIamportPayment(call: any, callback: any) {
    const { productId, quantity, userId } = JSON.parse(call.request.params);

    if (isNil(productId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'productId is required',
      });
    }

    try {
      const res = await this.iamportHandlers.createPayment(productId, quantity, userId);

      return callback(null, { result: JSON.stringify(res) });
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }
  }

  async completeIamportPayment(call: any, callback: any) {
    const { imp_uid, merchant_uid } = JSON.parse(call.request.params);

    if (isNil(imp_uid) || isNil(merchant_uid)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'imp_uid and merchant_uid are required',
      });
    }

    try {
      const success = await this.iamportHandlers.completePayment(imp_uid, merchant_uid);
      if (success) {
        return callback(null, {
          result: JSON.stringify({ message: 'Payment succeeded' }),
        });
      }
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }

    return callback({ code: grpc.status.INTERNAL, message: 'Something went wrong' });
  }

  async registerRoutes() {
    let activeRoutes = await this.getRegisteredRoutes();

    this.grpcSdk.router
      .registerRouter(this.server, activeRoutes, {
        getProducts: this.getProducts.bind(this),
        getSubscriptions: this.getSubscriptions.bind(this),
        createStripePayment: this.stripeHandlers.createPayment.bind(this.stripeHandlers),
        createStripePaymentWithSavedCard: this.stripeHandlers.createPaymentWithSavedCard.bind(
          this.stripeHandlers
        ),
        cancelStripePayment: this.stripeHandlers.cancelPayment.bind(this.stripeHandlers),
        refundStripePayment: this.stripeHandlers.refundPayment.bind(this.stripeHandlers),
        getStripePaymentMethods: this.stripeHandlers.getPaymentMethods.bind(
          this.stripeHandlers
        ),
        completeStripePayment: this.stripeHandlers.completePayment.bind(
          this.stripeHandlers
        ),
        createIamportPayment: this.createIamportPayment.bind(this),
        completeIamportPayment: this.completeIamportPayment.bind(this),
        addIamportCard: this.iamportHandlers.addCard.bind(this.iamportHandlers),
        validateIamportCard: this.iamportHandlers.validateCard.bind(this.iamportHandlers),
        subscribeToProductIamport: this.iamportHandlers.subscribeToProduct.bind(
          this.iamportHandlers
        ),
        cancelIamportSubscription: this.iamportHandlers.cancelSubscription.bind(
          this.iamportHandlers
        ),
        iamportSubscriptionCallback: this.iamportHandlers.subscriptionCallback.bind(
          this.iamportHandlers
        ),
        getIamportPaymentMethods: this.iamportHandlers.getPaymentMethods.bind(
          this.iamportHandlers
        ),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  async getRegisteredRoutes(): Promise<any[]> {
    let routesArray: any[] = [];

    let errorMessage = null;
    let paymentsActive = await this.stripeHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && paymentsActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/stripe/createPayment',
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                userId: TYPE.String,
                saveCard: TYPE.Boolean,
              },
            },
            new ConduitRouteReturnDefinition('CreateStripePaymentResponse', {
              clientSecret: ConduitString.Required,
              paymentId: ConduitString.Required,
            }),
            'createStripePayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/stripe/createPaymentWithSavedCard',
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                cardId: TYPE.Boolean,
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('CreatePaymentWithSavedCardResponse', {
              clientSecret: ConduitString.Required,
              paymentId: ConduitString.Optional,
              paymentMethod: ConduitString.Optional,
            }),
            'createStripePaymentWithSavedCard'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/stripe/cancelPayment',
              action: ConduitRouteActions.UPDATE,
              bodyParams: {
                paymentId: TYPE.String,
                userId: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition(
              'CancelPaymentWithSavedCardResponse',
              'Boolean'
            ),
            'cancelStripePayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/stripe/refundPayment',
              action: ConduitRouteActions.UPDATE,
              bodyParams: {
                paymentId: TYPE.String,
                userId: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('RefundStripePaymentResponse', 'Boolean'),
            'refundStripePayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/stripe/getPaymentMethods',
              action: ConduitRouteActions.GET,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('GetStripePaymentMethodsResponse', {
              paymentMethods: TYPE.JSON,
            }),
            'getStripePaymentMethods'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/hook/payments/stripe/completePayment',
              action: ConduitRouteActions.POST,
            },
            new ConduitRouteReturnDefinition('CompleteStripePaymentResponse', 'String'),
            'completeStripePayment'
          )
        )
      );
    }

    errorMessage = null;
    paymentsActive = await this.iamportHandlers
      .validate()
      .catch((e: any) => (errorMessage = e));
    if (!errorMessage && paymentsActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/createPayment',
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                quantity: TYPE.Number,
                userId: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('CreateIamportPaymentResponse', {
              merchant_uid: TYPE.String,
              amount: TYPE.Number,
            }),
            'createIamportPayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/addCard',
              action: ConduitRouteActions.POST,
              bodyParams: {
                email: TYPE.String,
                buyerName: TYPE.String,
                phoneNumber: TYPE.String,
                address: TYPE.String,
                postCode: TYPE.String,
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('AddIamportCardResponse', {
              customerId: ConduitString.Required,
              merchant_uid: ConduitString.Required,
            }),
            'addIamportCard'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/validateCard/:customerId',
              action: ConduitRouteActions.POST,
              urlParams: {
                customerId: TYPE.String,
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('ValidateIamportCardResponse', 'String'),
            'validateIamportCard'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/completePayment',
              action: ConduitRouteActions.POST,
              bodyParams: {
                imp_uid: TYPE.String,
                merchant_uid: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('completeIamportPaymentResponse', 'String'),
            'completeIamportPayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/subscribe',
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                customerId: TYPE.String, // this is need because iamport uses customer id as the billing method
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('SubscribeToProductIamportResponse', {
              subscription: TYPE.String,
            }),
            'subscribeToProductIamport'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/cancelSubscription/:subscriptionId',
              action: ConduitRouteActions.UPDATE,
              urlParams: {
                subscriptionId: TYPE.String,
              },
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition(
              'CancelIamportSubscriptionResponse',
              'String'
            ),
            'cancelIamportSubscription'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/hook/payments/iamport/subscriptionCallback',
              action: ConduitRouteActions.POST,
              bodyParams: {
                imp_uid: TYPE.String,
                merchant_uid: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition(
              'IamportSubscriptionCallbackResponse',
              'String'
            ),
            'iamportSubscriptionCallback'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/payments/iamport/getPaymentMethods',
              action: ConduitRouteActions.GET,
              middlewares: ['authMiddleware'],
            },
            new ConduitRouteReturnDefinition('GetIamportPaymentMethodsResponse', {
              paymentMethods: TYPE.JSON,
            }),
            'getIamportPaymentMethods'
          )
        )
      );
    }

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/payments/products',
            action: ConduitRouteActions.GET,
          },
          new ConduitRouteReturnDefinition('GetProductsResponse', {
            products: [
              {
                _id: TYPE.String,
                name: TYPE.String,
                value: TYPE.Number,
                currency: TYPE.String,
                isSubscription: TYPE.Boolean,
                renewEvery: ConduitString.Optional,
              },
            ],
          }),
          'getProducts'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/payments/subscriptions',
            action: ConduitRouteActions.GET,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('GetProductsResponse', {
            subscriptions: [
              {
                _id: TYPE.String,
                product: TYPE.JSON,
                userId: TYPE.Number,
                customerId: TYPE.String,
                iamport: TYPE.JSON,
                activeUntil: TYPE.Date,
                transactions: TYPE.JSON,
                provider: TYPE.String,
              },
            ],
          }),
          'getSubscriptions'
        )
      )
    );

    return routesArray;
  }
}
