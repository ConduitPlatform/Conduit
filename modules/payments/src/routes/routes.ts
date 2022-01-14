import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructRoute, GrpcError,
  GrpcServer, ParsedRouterRequest,
  TYPE, UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { StripeHandlers } from '../handlers/stripe';
import { Product, Subscription } from '../models';

export class PaymentsRoutes {
  private readonly stripeHandlers: StripeHandlers;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.stripeHandlers = new StripeHandlers(grpcSdk);
  }

  async getStripe(): Promise<StripeHandlers | null> {
    const paymentsActive = await this.stripeHandlers
      .validate()
      .catch(() => { if (paymentsActive) return Promise.resolve(this.stripeHandlers); });
    return Promise.resolve(null);
  }

  async getProducts(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return Product.getInstance()
      .findMany({})
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  }

  async getSubscriptions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    }
   return Subscription.getInstance()
      .findMany(
        {
          userId: context.user._id,
          activeUntil: { $gte: new Date() },
        },
        undefined,
        undefined,
        undefined,
        undefined,
        ['product']
      )
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
  }

  async registerRoutes() {
    let activeRoutes = await this.getRegisteredRoutes();

    this.grpcSdk.router
      .registerRouterAsync(this.server, activeRoutes, {
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
              path: '/stripe/createPayment',
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
              path: '/stripe/createPaymentWithSavedCard',
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
              path: '/stripe/cancelPayment',
              action: ConduitRouteActions.UPDATE,
              bodyParams: {
                paymentId: TYPE.String,
                userId: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('CancelPaymentWithSavedCardResponse', {
              success: TYPE.Boolean,
            }),
            'cancelStripePayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/stripe/refundPayment',
              action: ConduitRouteActions.UPDATE,
              bodyParams: {
                paymentId: TYPE.String,
                userId: TYPE.String,
              },
            },
            new ConduitRouteReturnDefinition('RefundStripePaymentResponse', {
              success: TYPE.Boolean,
            }),
            'refundStripePayment'
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: '/stripe/getPaymentMethods',
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
              path: '/hook/stripe/completePayment',
              action: ConduitRouteActions.POST,
            },
            new ConduitRouteReturnDefinition('CompleteStripePaymentResponse', 'String'),
            'completeStripePayment'
          )
        )
      );
    }

    errorMessage = null;

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/products',
            action: ConduitRouteActions.GET,
          },
          new ConduitRouteReturnDefinition('GetProductsResponse', {
            products: [Product.getInstance().fields],
          }),
          'getProducts'
        )
      )
    );

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: '/subscriptions',
            action: ConduitRouteActions.GET,
            middlewares: ['authMiddleware'],
          },
          new ConduitRouteReturnDefinition('GetProductsResponse', {
            subscriptions: [Subscription.getInstance().fields],
          }),
          'getSubscriptions'
        )
      )
    );

    return routesArray;
  }
}
