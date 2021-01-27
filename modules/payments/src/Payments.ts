import PaymentsConfigSchema from "./config";
import { isNil } from "lodash";
import ConduitGrpcSdk, { grpcModule } from "@quintessential-sft/conduit-grpc-sdk";
import path from "path";
import * as grpc from "grpc";
import { IPaymentProvider } from "./interfaces/IPaymentProvider";
import { StripeProvider } from "./providers/stripe";
import { PaymentsRoutes } from "./routes/Routes";
import * as models from "./models";
import { AdminHandlers } from "./admin/admin";

let protoLoader = require("@grpc/proto-loader");

export default class PaymentsModule {
  private database: any
  private _admin: AdminHandlers;
  private _provider: IPaymentProvider | undefined;
  private providerName: string;
  private isRunning: boolean = false;
  private readonly _url: string;
  private readonly grpcServer: any;
  private _router: PaymentsRoutes;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    let packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "./payments.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    let protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);
    let payments = protoDescriptor.payments.Payments;
    this.grpcServer = new grpcModule.Server();

    this.grpcServer.addService(payments.service, {
      setConfig: this.setConfig.bind(this),
      createPayment: this.createPayment.bind(this),
      cancelPayment: this.cancelPayment.bind(this),
      refundPayment: this.refundPayment.bind(this),
    });

    this._url = process.env.SERVICE_URL || "0.0.0.0:0";
    let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure(), {
      "grpc.max_receive_message_length": 1024 * 1024 * 100,
      "grpc.max_send_message_length": 1024 * 1024 * 100
    });
    this._url = process.env.SERVICE_URL || "0.0.0.0:" + result;
    console.log("bound on: ", this._url);

    this.grpcSdk
      .waitForExistence("database-provider")
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .then(() => {
        const self = this;
        this.grpcSdk.bus?.subscribe("payments", (message: string) => {
          if (message === "config-update") {
            this.enableModule()
              .then((r: any) => {
                console.log("Updated payments configuration");
              })
              .catch((e: Error) => {
                console.log("Failed to update payments config");
              });
          }
        });
      })
      .catch(() => {
        console.log("Bus did not initialize!");
      })
      .then(() => {
        return this.grpcSdk.config.get("payments");
      })
      .catch(() => {
        return this.grpcSdk.config.updateConfig(PaymentsConfigSchema.getProperties(), "payments");
      })
      .then((paymentsConfig: any) => {
        return this.grpcSdk.config.addFieldstoConfig(PaymentsConfigSchema.getProperties(), "payments");
      })
      .catch(() => {
        console.log("payments config did not update");
      })
      .then((paymentsConfig: any) => {
        if (paymentsConfig.active) {
          return this.enableModule();
        }
      })
      .catch(console.log);
  }

  get url(): string {
    return this._url;
  }

  async setConfig(call: any, callback: any) {
    const newConfig = JSON.parse(call.request.newConfig);
    if (isNil(newConfig.active) || isNil(newConfig.providerName) || isNil(newConfig[newConfig.providerName])) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration given" });
    }
    if (!PaymentsConfigSchema.load(newConfig).validate()) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "Invalid configuration given" });
    }

    let errorMessage: string | null = null;
    const updateResult = await this.grpcSdk.config
      .updateConfig(newConfig, "payments")
      .catch((e: Error) => errorMessage = e.message);
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const paymentsConfig = await this.grpcSdk.config.get("payments");
    if (paymentsConfig.active) {
      await this.enableModule().catch((e: Error) => errorMessage = e.message);
      if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      this.grpcSdk.bus?.publish("payments", "config-update");
    } else {
      return callback({ code: grpc.status.INTERNAL, message: "Module is not active"});
    }
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { updateConfig: JSON.stringify(updateResult) });
  }

  async createPayment(call: any, callback: any) {
    const productId = call.request.productId;
    const userId = call.request.userId;

    if (isNil(this._provider)) {
      return callback({ code: grpc.status.INTERNAL, message: "Payments provider not initialized"});
    }
    if (isNil(productId)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "productId is required" });
    }

    let errorMessage: string | null = null;

    const product = await this.database.findOne("Product", { _id: productId })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage
      });
    }
    if (isNil(product)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "product doesn't exist"
      });
    }

    if (product.isSubscription) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "product can't be a subscription"
      });
    }

    const { clientSecret, paymentId } = await this._provider.createPayment(product.name, product.currency, product.value, userId)
      .catch((e: Error) => errorMessage = e.message);
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { clientSecret, paymentId });
  }

  async cancelPayment(call: any, callback: any) {
    const paymentId = call.request.paymentId;
    const userId = call.request.userId;

    if (isNil(this._provider)) {
      return callback({ code: grpc.status.INTERNAL, message: "Payments provider not initialized"});
    }
    if (isNil(paymentId)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "paymentId is required" });
    }

    let errorMessage: string | null = null;
    await this._provider.cancelPayment(paymentId, userId)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { success: true });
  }

  async refundPayment(call: any, callback: any) {
    const paymentId = call.request.paymentId;
    const userId = call.request.userId;

    if (isNil(this._provider)) {
      return callback({ code: grpc.status.INTERNAL, message: "Payments provider not initialized"});
    }
    if (isNil(paymentId)) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: "paymentId is required" });
    }

    let errorMessage: string | null = null;
    await this._provider.refundPayment(paymentId, userId)
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    return callback(null, { success: true });
  }

  private async enableModule() {
    if (!this.isRunning) {
      this.database = this.grpcSdk.databaseProvider;
      this._admin = new AdminHandlers(this.grpcServer, this.grpcSdk);
      await this.registerSchemas();
      await this.initProvider();
      this._router = new PaymentsRoutes(this.grpcServer, this.grpcSdk, this.providerName);
      this.grpcServer.start();
      this.isRunning = true;
    }
    let url = this._url;
    if (process.env.REGISTER_NAME === "true") {
      url = "payments:" + this._url.split(":"[1]);
    }
    this._router.registerRoutes(url);
  }

  private async initProvider() {
    const paymentsConfig = await this.grpcSdk.config.get("payments");
    this.providerName = paymentsConfig.providerName;
    const settings = paymentsConfig[this.providerName];

    if (this.providerName === 'stripe') {
      this._provider = new StripeProvider(settings.secret_key, this.grpcSdk, this.database);
    } else {
      console.error("Payment provider not supported");
      process.exit(-1);
    }
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model) => {
      return this.database.createSchemaFromAdapter(model);
    });
    return Promise.all(promises);
  }

}