import * as grpc from "grpc";
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  TYPE,
  ConduitString
} from "@quintessential-sft/conduit-grpc-sdk";
import fs from "fs";
import path from "path";
import { isNil } from "lodash";

const protoLoader = require("@grpc/proto-loader");
const PROTO_PATH = __dirname + "/router.proto";

export class PaymentsRoutes {
  private database: any;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
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
      completePayment: this.completePayment.bind(this),
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

  completePayment(call: any, callback: any) {
    return callback(null, { result: JSON.stringify("ok") });
  }

  registerRoutes(url: string) {
    let routerProtoFile = fs.readFileSync(path.resolve(__dirname, "./router.proto"));
    let activeRoutes = this.getRegisteredRoutes();
    this.grpcSdk.router.register(activeRoutes, routerProtoFile.toString("utf-8"), url).catch((err: Error) => {
      console.log("Failed to register routes for payments module");
      console.log(err);
    });
  }

  getRegisteredRoutes(): any[] {
    let routesArray: any[] = [];

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: "/hook/payments/products",
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

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            path: "/hook/payments/completePayment",
            action: ConduitRouteActions.POST,
          },
          new ConduitRouteReturnDefinition('CompletePaymentResponse', 'String'),
          "completePayment"
        )
      )
    );

    return routesArray;
  }
}