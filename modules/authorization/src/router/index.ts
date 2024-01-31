import {
  ConduitBoolean,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import { PermissionsController } from '../controllers/index.js';
import { Permission, Relationship } from '../models/index.js';
import { isEmpty } from 'lodash-es';
import { Status } from '@grpc/grpc-js/build/src/constants.js';

export class AuthorizationRouter {
  private _routingManager: RoutingManager;
  private _permissionsController: PermissionsController;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this._permissionsController = PermissionsController.getInstance(this.grpcSdk);
    this.registeredRoutes();
  }

  async registeredRoutes() {
    await this.grpcSdk.waitForExistence('router');
    this._routingManager = new RoutingManager(this.grpcSdk.router!, this.server);
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
        if (scope && !isEmpty(scope)) {
          const scopeRelations = await Relationship.getInstance().findMany({
            subject: `User:${user._id}`,
            resource: scope,
          });
          if (scopeRelations.length === 0) {
            const scopePermissions = await Permission.getInstance().findMany({
              subject: `User:${user._id}`,
              resource: scope,
            });
            if (scopePermissions.length === 0) {
              throw new GrpcError(
                Status.PERMISSION_DENIED,
                'User does not have access to scope',
              );
            }
          }
        }
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
        const { user } = call.request.context;
        const { resource } = call.request.urlParams;
        const { scope } = call.request.queryParams;
        if (scope && !isEmpty(scope)) {
          const scopeRelations = await Relationship.getInstance().findMany({
            subject: `User:${user._id}`,
            resource: scope,
          });
          if (scopeRelations.length === 0) {
            const scopePermissions = await Permission.getInstance().findMany({
              subject: `User:${user._id}`,
              resource: scope,
            });
            if (scopePermissions.length === 0) {
              throw new GrpcError(
                Status.PERMISSION_DENIED,
                'User does not have access to scope',
              );
            }
          }
        }
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
