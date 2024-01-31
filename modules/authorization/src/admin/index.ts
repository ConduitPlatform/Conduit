import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { GrpcServer, RoutingManager } from '@conduitplatform/module-tools';
import { ResourceHandler } from './resources.js';
import { RelationHandler } from './relations.js';
import {
  ActorIndex,
  ObjectIndex,
  Relationship,
  ResourceDefinition,
} from '../models/index.js';
import { QueueController } from '../controllers/index.js';

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

  async reconstructIndices(
    call: ParsedRouterRequest,
    callback: (response: UnparsedRouterResponse) => void,
  ) {
    // used to trigger an index re-construction
    ConduitGrpcSdk.Logger.warn('Reconstructing indices...');
    ConduitGrpcSdk.Logger.warn('Wiping index data...');
    await Promise.all([
      ActorIndex.getInstance().deleteMany({}),
      ObjectIndex.getInstance().deleteMany({}),
    ]);
    callback('ok');
    ConduitGrpcSdk.Logger.warn('Beginning index reconstruction...');
    const resources = await ResourceDefinition.getInstance().findMany({});
    ConduitGrpcSdk.Logger.info(`Found ${resources.length} resources...`);
    for (const resource of resources) {
      ConduitGrpcSdk.Logger.info(`Reconstructing index for ${resource.name}...`);
      const query = {
        subjectType: resource.name,
      };
      const relationsCount = await Relationship.getInstance().countDocuments(query);
      ConduitGrpcSdk.Logger.info(
        `Found ${relationsCount} relations for ${resource.name}...`,
      );
      let processed = 0;
      let relations = await Relationship.getInstance().findMany(
        query,
        undefined,
        processed,
        1000,
      );
      while (relations.length > 0) {
        ConduitGrpcSdk.Logger.info(
          `Reconstructing index for ${resource.name}... ${relations.length} remaining`,
        );
        await QueueController.getInstance().addRelationIndexJob(
          relations.map(r => {
            return { subject: r.subject, relation: r.relation, object: r.resource };
          }),
        );
        processed += relations.length;
        relations = await Relationship.getInstance().findMany(
          query,
          undefined,
          processed,
          1000,
        );
      }
    }
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/indexer/reconstruct',
        action: ConduitRouteActions.POST,
        description: `Wipes and re-constructs the relation indexes.`,
      },
      new ConduitRouteReturnDefinition('IndexReconstruct', 'String'),
      this.reconstructIndices.bind(this),
    );
    this.relationHandler.registerRoutes(this.routingManager);
    this.resourceHandler.registerRoutes(this.routingManager);
    this.routingManager.registerRoutes().then();
  }
}
