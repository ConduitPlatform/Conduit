import { AdminHandlers } from './admin/admin';
import {
  ConduitServiceModule,
  GrpcServer,
} from '@quintessential-sft/conduit-grpc-sdk';
import { CmsRoutes } from './routes/Routes';
import { SchemaController } from './controllers/cms/schema.controller';
import { CustomEndpointController } from './controllers/customEndpoints/customEndpoint.controller';
import { migrateSchemaDefinitions } from './migrations/schemaDefinitions.migration';

export class CMS extends ConduitServiceModule {
  private stateActive = true;

  async initialize(servicePort?: string) {
    this.grpcServer = new GrpcServer(servicePort);
    this._port = (await this.grpcServer.createNewServer()).toString();
    this.grpcServer.start();
    console.log('Grpc server is online');
  }

  async activate() {
    await this.grpcSdk.waitForExistence('database');
    await this.grpcSdk.initializeEventBus();
    let consumerRoutes = new CmsRoutes(this.grpcServer, this.grpcSdk);
    let schemaController = new SchemaController(
      this.grpcSdk,
      consumerRoutes,
      this.stateActive
    );
    let customEndpointController = new CustomEndpointController(
      this.grpcSdk,
      consumerRoutes,
      this.stateActive
    );
    new AdminHandlers(
      this.grpcServer,
      this.grpcSdk,
      schemaController,
      customEndpointController
    );
    await migrateSchemaDefinitions(this.grpcSdk);
  }
}
