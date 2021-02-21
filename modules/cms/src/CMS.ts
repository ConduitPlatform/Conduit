import { AdminHandlers } from "./admin/admin";
import ConduitGrpcSdk, {GrpcServer} from "@quintessential-sft/conduit-grpc-sdk";
import { CmsRoutes } from "./routes/Routes";
import { SchemaController } from "./controllers/cms/schema.controller";
import process from "process";
import { CustomEndpointController } from "./controllers/customEndpoints/customEndpoint.controller";

export class CMS {
  private _url: string;
  private readonly grpcServer: GrpcServer;
  private stateActive = true;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {

    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._url = this.grpcServer.url;

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
