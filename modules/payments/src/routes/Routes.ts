import * as grpc from "grpc";
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructRoute,
  TYPE
} from "@quintessential-sft/conduit-grpc-sdk";
import fs from "fs";
import path from "path";
import { isNil } from "lodash";
import { StripeHandlers } from "../handlers/stripe";
import { IamportHandlers } from "../handlers/iamport";

const protoLoader = require("@grpc/proto-loader");
const PROTO_PATH = __dirname + "/router.proto";

export class PaymentsRoutes {
  private database: any;
  private readonly stripeHandlers: StripeHandlers;
  private readonly iamportHandler: IamportHandlers;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
    this.stripeHandlers = new StripeHandlers(grpcSdk);
    this.iamportHandler = new IamportHandlers(grpcSdk);
    const self = this;

    grpcSdk.waitForExistence('database-provider')
      .then(r => {
        self.database = self.grpcSdk.databaseProvider;
      });

    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const router = protoDescriptor.payments.router.Router;
    server.addService(router.service, {
      getProducts: this.getProducts.bind(this),
      createStripePayment: this.stripeHandlers.createPayment.bind(this.stripeHandlers),
      createStripePaymentWithSavedCard: this.stripeHandlers.createPaymentWithSavedCard.bind(this.stripeHandlers),
      cancelStripePayment: this.stripeHandlers.cancelPayment.bind(this.stripeHandlers),
      refundStripePayment: this.stripeHandlers.refundPayment.bind(this.stripeHandlers),
      getStripePaymentMethods: this.stripeHandlers.getPaymentMethods.bind(this.stripeHandlers),
      completeStripePayment: this.stripeHandlers.completePayment.bind(this.stripeHandlers),
      addIamportCard: this.iamportHandler.addCard.bind(this.iamportHandler),
      validateIamportCard: this.iamportHandler.validateCard.bind(this.iamportHandler),
      completeIamportPayment: this.iamportHandler.completePayment.bind(this.iamportHandler),
      subscribeToProductIamport: this.iamportHandler.subscribeToProduct.bind(this.iamportHandler),
      cancelIamportSubscription: this.iamportHandler.cancelSubscription.bind(this.iamportHandler),
      iamportSubscriptionCallback: this.iamportHandler.subscriptionCallback.bind(this.iamportHandler),
    });
  }

  async getProducts(call: any, callback: any) {
    let errorMessage: string | null = null;
    const products = await this.database.findMany('Product', {})
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage
      });
    }

    return callback(null, { result: JSON.stringify({ products }) });
  }

  async registerRoutes(url: string) {
    let routerProtoFile = fs.readFileSync(path.resolve(__dirname, "./router.proto"));
    let activeRoutes = await this.getRegisteredRoutes();
    this.grpcSdk.router.register(activeRoutes, routerProtoFile.toString("utf-8"), url).catch((err: Error) => {
      console.log("Failed to register routes for payments module");
      console.log(err);
    });
  }

  async getRegisteredRoutes(): Promise<any[]> {
    let routesArray: any[] = [];

    let errorMessage = null;
    let paymentsActive = await this.stripeHandlers.validate().catch((e: any) => (errorMessage = e));
    if (!errorMessage && paymentsActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/stripe/createPayment",
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                userId: TYPE.String,
                saveCard: TYPE.Boolean
              }
            },
            new ConduitRouteReturnDefinition("CreateStripePaymentResponse", {
              clientSecret: ConduitString.Required,
              paymentId: ConduitString.Required
            }),
            "createStripePayment"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/stripe/createPaymentWithSavedCard",
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                cardId: TYPE.Boolean
              },
              middlewares: ['authMiddleware']
            },
            new ConduitRouteReturnDefinition("CreatePaymentWithSavedCardResponse", {
              clientSecret: ConduitString.Required,
              paymentId: ConduitString.Optional,
              paymentMethod: ConduitString.Optional
            }),
            "createStripePaymentWithSavedCard"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/stripe/cancelPayment",
              action: ConduitRouteActions.UPDATE,
              bodyParams: {
                paymentId: TYPE.String,
                userId: TYPE.String
              }
            },
            new ConduitRouteReturnDefinition("CancelPaymentWithSavedCardResponse", 'Boolean'),
            "cancelStripePayment"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/stripe/refundPayment",
              action: ConduitRouteActions.UPDATE,
              bodyParams: {
                paymentId: TYPE.String,
                userId: TYPE.String
              },
            },
            new ConduitRouteReturnDefinition("RefundStripePaymentResponse", 'Boolean'),
            "refundStripePayment"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/stripe/getPaymentMethods",
              action: ConduitRouteActions.GET,
              middlewares: ['authMiddleware']
            },
            new ConduitRouteReturnDefinition("GetStripePaymentMethodsResponse", {
              paymentMethods: TYPE.JSON
            }),
            "getStripePaymentMethods"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/hook/payments/stripe/completePayment",
              action: ConduitRouteActions.POST,
            },
            new ConduitRouteReturnDefinition('CompleteStripePaymentResponse', 'String'),
            "completeStripePayment"
          )
        )
      );
    }

    errorMessage = null;
    paymentsActive = await this.iamportHandler.validate().catch((e: any) => (errorMessage = e));
    if (!errorMessage && paymentsActive) {
      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/iamport/addCard",
              action: ConduitRouteActions.POST,
              bodyParams: {
                email: TYPE.String,
                buyerName: TYPE.String,
                phoneNumber: TYPE.String,
                address: TYPE.String,
                postCode: TYPE.String
              },
              middlewares: ['authMiddleware']
            },
            new ConduitRouteReturnDefinition("AddIamportCardResponse", {
              customerId: ConduitString.Required,
              merchantId: ConduitString.Required
            }),
            "addIamportCard"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/iamport/validateCard/:customerId",
              action: ConduitRouteActions.POST,
              urlParams: {
                customerId: TYPE.String
              },
              middlewares: ['authMiddleware']
            },
            new ConduitRouteReturnDefinition("ValidateIamportCardResponse", 'String'),
            "validateIamportCard"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/iamport/completePayment",
              action: ConduitRouteActions.POST,
              bodyParams: {
                data: TYPE.JSON,
                userId: TYPE.String
              }
            },
            new ConduitRouteReturnDefinition("completeIamportPaymentResponse", 'String'),
            "completeIamportPayment"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/iamport/subscribe",
              action: ConduitRouteActions.POST,
              bodyParams: {
                productId: TYPE.String,
                customerId: TYPE.String // this is need because iamport uses customer id as the billing method
              },
              middlewares: ['authMiddleware']
            },
            new ConduitRouteReturnDefinition("SubscribeToProductIamportResponse", {
              subscription: TYPE.String
            }),
            "subscribeToProductIamport"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/payments/iamport/cancelSubscription/:subscriptionId",
              action: ConduitRouteActions.UPDATE,
              urlParams: {
                subscriptionId: TYPE.String
              },
              middlewares: ['authMiddleware']
            },
            new ConduitRouteReturnDefinition("CancelIamportSubscriptionResponse", 'String'),
            "cancelIamportSubscription"
          )
        )
      );

      routesArray.push(
        constructRoute(
          new ConduitRoute(
            {
              path: "/hook/payments/iamport/subscriptionCallback",
              action: ConduitRouteActions.POST,
              bodyParams: {
                imp_uid: TYPE.String,
                merchant_uid: TYPE.String
              },
            },
            new ConduitRouteReturnDefinition("IamportSubscriptionCallbackResponse", 'String'),
            "iamportSubscriptionCallback"
          )
        )
      );

    }

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: "/payments/products",
            action: ConduitRouteActions.GET,
          },
          new ConduitRouteReturnDefinition('GetProductsResponse', {
            products: [{
              _id: TYPE.String,
              name: TYPE.String,
              value: TYPE.Number,
              currency: TYPE.String,
              isSubscription: TYPE.Boolean,
              renewEvery: ConduitString.Optional
            }]
          }),
          "getProducts"
        )
      )
    );

    return routesArray;
  }
}