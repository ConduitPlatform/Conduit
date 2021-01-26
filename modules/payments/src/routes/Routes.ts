import * as grpc from "grpc";
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
} from "@quintessential-sft/conduit-grpc-sdk";
import fs from "fs";
import path from "path";

const protoLoader = require("@grpc/proto-loader");
const PROTO_PATH = __dirname + "/router.proto";

export class PaymentsRoutes {
  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
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
      completePayment: this.completePayment.bind(this),
    });
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