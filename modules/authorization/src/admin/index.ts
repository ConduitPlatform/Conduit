import ConduitGrpcSdk, { GrpcServer, RoutingManager } from '@conduitplatform/grpc-sdk';
import { ResourceHandler } from './resources';
import { RelationHandler } from './relations';

export class AdminHandlers {
  private readonly resourceHandler: ResourceHandler;
  private readonly relationHandler: RelationHandler;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.resourceHandler = new ResourceHandler(this.grpcSdk);
    this.relationHandler = new RelationHandler(this.grpcSdk);
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.relationHandler.registerRoutes(this.routingManager);
    this.resourceHandler.registerRoutes(this.routingManager);
    this.routingManager.registerRoutes().then();
  }

  reconstructIndices() {
    // used to trigger an index re-construction
  }
}
