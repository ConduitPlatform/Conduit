import { AdminHandlers } from './admin/admin';
import ConduitGrpcSdk, {
  ConduitServiceModule,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import { CmsRoutes } from './routes/Routes';
import { SchemaController } from './controllers/cms/schema.controller';
import { CustomEndpointController } from './controllers/customEndpoints/customEndpoint.controller';

export class CMS implements ConduitServiceModule {
  private grpcServer!: GrpcServer;
  private stateActive = true;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private _port!: string;

  get port(): string {
    return this._port;
  }

  async initialize() {
    this.grpcServer = new GrpcServer(process.env.SERVICE_URL);
    this._port = (await this.grpcServer.createNewServer()).toString();
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    const self = this;

    await this.grpcSdk.waitForExistence('database-provider');
    await this.grpcSdk.initializeEventBus();
    let consumerRoutes = new CmsRoutes(self.grpcServer, self.grpcSdk);
    let schemaController = new SchemaController(
      self.grpcSdk,
      consumerRoutes,
      self.stateActive
    );
    let customEndpointController = new CustomEndpointController(
      self.grpcSdk,
      consumerRoutes,
      self.stateActive
    );
    new AdminHandlers(
      self.grpcServer,
      self.grpcSdk,
      schemaController,
      customEndpointController
    );
  }
}
