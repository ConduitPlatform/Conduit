import {
  ConduitBoolean,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import { PermissionsController } from '../controllers';
import { Relationship } from '../models';

export class AuthorizationRouter {
  private _routingManager: RoutingManager;
  private _permissionsController: PermissionsController;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this._permissionsController = PermissionsController.getInstance(this.grpcSdk);
  }

  async registeredRoutes() {
    this._routingManager.clear();
    this._routingManager.route(
      {
        queryParams: {
          action: ConduitString.Required,
          resource: ConduitString.Required,
          scope: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        description: `Checks if a user has the given permission, on a resource either directly or through a scope.`,
        middlewares: ['authMiddleware'],
        path: '/check',
      },
      new ConduitRouteReturnDefinition('CheckPermissionResponse', {
        allowed: ConduitBoolean.Required,
      }),
      async (call: ParsedRouterRequest) => {
        const { action, resource, scope } = call.request.queryParams;
        const { user } = call.request.context;
        const allowed = await this._permissionsController.can(
          scope ?? `User:${user._id}`,
          action,
          resource,
        );
        return { allowed };
      },
    );
    this._routingManager.route(
      {
        urlParams: {
          resource: ConduitString.Required,
        },
        queryParams: {
          scope: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        description: `Get a user's or scope's roles for a resource.`,
        middlewares: ['authMiddleware'],
        path: '/role/:resource',
      },
      new ConduitRouteReturnDefinition('GetResourceRolesResponse', {
        roles: [ConduitString.Required],
      }),
      async (call: ParsedRouterRequest) => {
        const { resource } = call.request.urlParams;
        const { scope } = call.request.queryParams;
        const { user } = call.request.context;
        const relations = await Relationship.getInstance().findMany({
          subject: scope ?? `User:${user._id}`,
          resource,
        });
        const roles = relations.map(relation => relation.relation);
        return { roles };
      },
    );
    await this._routingManager.registerRoutes();
  }
}
