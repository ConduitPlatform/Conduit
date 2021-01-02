import schema from "./models/schemaDefinitions.schema";
import { AdminHandlers } from "./admin/admin";
import ConduitGrpcSdk, { ConduitSchema, grpcModule } from "@quintessential-sft/conduit-grpc-sdk";
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
    let result = this.grpcServer.bind(this._url, grpcModule.ServerCredentials.createInsecure());
    this._url = process.env.SERVICE_URL || "0.0.0.0:" + result;
    const self = this;

    this.grpcSdk
      .waitForExistence("database-provider")
      .catch((err) => {
        console.error("Failed to wait for database");
        process.exit(-1);
      })
      .then((r) => {
        return this.grpcSdk.initializeEventBus();
      })
      .catch((err) => {
        console.log("Failed to start redis connection");
        return (this.stateActive = false);
      })
      .then(() => {
        let url = self.url;
        if (process.env.REGISTER_NAME === "true") {
          url = "cms:" + url.split(":")[1];
        }
        let consumerRoutes = new CmsRoutes(self.grpcServer, self.grpcSdk, url);
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
