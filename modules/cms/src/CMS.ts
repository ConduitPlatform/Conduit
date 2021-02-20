import { AdminHandlers } from "./admin/admin";
import ConduitGrpcSdk, { grpcModule } from "@quintessential-sft/conduit-grpc-sdk";
import path from "path";
import { CmsRoutes } from "./routes/Routes";
import { SchemaController } from "./controllers/cms/schema.controller";
import process from "process";
import { CustomEndpointController } from "./controllers/customEndpoints/customEndpoint.controller";

let protoLoader = require("@grpc/proto-loader");

export class CMS {
  private _url: string;
  private readonly grpcServer: any;
  private stateActive = true;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "./cms.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpcModule.loadPackageDefinition(packageDefinition);

    const cms = protoDescriptor.cms.CMS;
    this.grpcServer = new grpcModule.Server();
    // this.grpcServer.addService(cms.service, {});

    this._url = process.env.SERVICE_URL || "0.0.0.0:0";
    let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure(), {
      "grpc.max_receive_message_length": 1024 * 1024 * 100,
      "grpc.max_send_message_length": 1024 * 1024 * 100
    });
    this._url = process.env.SERVICE_URL || "0.0.0.0:" + result;
    const self = this;

    this.grpcSdk
      .waitForExistence("database-provider")
      .catch(() => {
        console.error("Failed to wait for database");
        process.exit(-1);
      })
      .then(() => {
        return this.grpcSdk.initializeEventBus();
      })
      .catch(() => {
        console.log("Failed to start redis connection");
        return (this.stateActive = false);
      })
      .then(() => {
        let consumerRoutes = new CmsRoutes(self.grpcServer, self.grpcSdk);
        let schemaController = new SchemaController(self.grpcSdk, consumerRoutes, self.stateActive);
        let customEndpointController = new CustomEndpointController(self.grpcSdk, consumerRoutes, self.stateActive);
        new AdminHandlers(self.grpcServer, self.grpcSdk, schemaController, customEndpointController);
        console.log("bound on:", self._url);
        self.grpcServer.start();
      })
      .catch(console.log);
  }

  get url(): string {
    return this._url;
  }
}
