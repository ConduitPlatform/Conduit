import { CmsHandlers } from '../handlers/cms/handler';
import ConduitGrpcSdk, {
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  GrpcServer,
  RequestHandlers,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

export class DatabaseRoutes {
  private readonly handlers: CmsHandlers;
  private crudRoutes: {
    input: ConduitRouteOptions;
    returnType: ConduitRouteReturnDefinition;
    handler: RequestHandlers;
  }[] = [];
  private customRoutes: {
    input: ConduitRouteOptions;
    returnType: ConduitRouteReturnDefinition;
    handler: RequestHandlers;
  }[] = [];
  private _scheduledTimeout: any = null;
  private _routingManager: RoutingManager;

  constructor(
    readonly server: GrpcServer,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.handlers = new CmsHandlers(grpcSdk, database);
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
  }

  addRoutes(
    routes: {
      input: ConduitRouteOptions;
      returnType: ConduitRouteReturnDefinition;
      handler: RequestHandlers;
    }[],
    crud: boolean = true,
  ) {
    if (crud) {
      this.crudRoutes = routes;
    } else {
      this.customRoutes = routes;
    }
  }

  requestRefresh() {
    if (this.crudRoutes.length == 0 && this.customRoutes.length == 0) return;
    this._scheduleTimeout();
  }

  private _scheduleTimeout() {
    if (this._scheduledTimeout) {
      clearTimeout(this._scheduledTimeout);
      this._scheduledTimeout = null;
    }

    this._scheduledTimeout = setTimeout(() => {
      try {
        this._refreshRoutes();
      } catch (err) {
        ConduitGrpcSdk.Logger.error(err as Error);
      }
      this._scheduledTimeout = null;
    }, 3000);
  }

  private _refreshRoutes() {
    this._routingManager.clear();
    this.crudRoutes.concat(this.customRoutes).forEach(route => {
      this._routingManager.route(route.input, route.returnType, route.handler);
    });
    this._routingManager.registerRoutes().catch((err: Error) => {
      ConduitGrpcSdk.Logger.error('Failed to register routes for module');
      ConduitGrpcSdk.Logger.error(err);
    });
  }
}
