import ConduitGrpcSdk, {
  ConduitBoolean,
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcServer,
  RouteOptionType,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { RouterAdmin } from './router';
import { SecurityAdmin } from './security';
import ConduitDefaultRouter from '../Router';
import { Client } from '../models';

export class AdminHandlers {
  private readonly routerAdmin: RouterAdmin;
  private readonly securityAdmin: SecurityAdmin;
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {
    this.routerAdmin = new RouterAdmin(this.grpcSdk, router);
    this.securityAdmin = new SecurityAdmin(this.grpcSdk);
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    this.routingManager.clear();

    this.routingManager.route(
      {
        path: '/router/middlewares',
        action: ConduitRouteActions.GET,
        description: `Returns middleware.`,
        queryParams: {
          sortByName: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetMiddlewares', {
        response: TYPE.JSON,
      }),
      this.routerAdmin.getMiddlewares.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/router/inject-middleware',
        action: ConduitRouteActions.PATCH,
        description: `Injects a middleware into an app route with a specific order (1 = first, -1 = last).`,
        queryParams: {
          path: ConduitString.Required,
          action: ConduitString.Required,
        },
        bodyParams: {
          middlewareName: ConduitString.Required,
          order: ConduitNumber.Required,
        },
      },
      new ConduitRouteReturnDefinition('InjectAppMiddleware', 'String'),
      this.routerAdmin.injectMiddleware.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/router/remove-middleware',
        action: ConduitRouteActions.PATCH,
        description: `Removes a patched middleware from an app route.`,
        queryParams: {
          path: ConduitString.Required,
          action: ConduitString.Required,
          middlewareName: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('RemoveAppMiddleware', 'String'),
      this.routerAdmin.removeMiddleware.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/routes',
        action: ConduitRouteActions.GET,
        description: `Returns available routes.`,
        queryParams: {
          sortByName: ConduitBoolean.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetRoutes', {
        response: TYPE.JSON,
      }),
      this.routerAdmin.getRoutes.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client',
        action: ConduitRouteActions.POST,
        description: `Creates a security client.`,
        bodyParams: {
          platform: ConduitString.Required,
          domain: ConduitString.Optional,
          alias: ConduitString.Optional,
          notes: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CreateSecurityClient', Client.name),
      this.securityAdmin.createSecurityClient.bind(this.securityAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a security client.`,
        urlParams: {
          id: { type: RouteOptionType.String, required: true },
        },
      },
      new ConduitRouteReturnDefinition('DeleteSecurityClient', {
        message: ConduitString.Required,
      }),
      this.securityAdmin.deleteSecurityClient.bind(this.securityAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client',
        action: ConduitRouteActions.GET,
        description: `Returns security clients.`,
      },
      new ConduitRouteReturnDefinition('GetSecurityClients', {
        clients: [Client.name],
      }),
      this.securityAdmin.getSecurityClients.bind(this.securityAdmin),
    );
    this.routingManager.route(
      {
        path: '/security/client/:id',
        urlParams: {
          id: ConduitString.Required,
        },
        action: ConduitRouteActions.UPDATE,
        description: `Updates a security client.`,
        bodyParams: {
          domain: ConduitString.Optional,
          alias: ConduitString.Optional,
          notes: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateSecurityClient', Client.name),
      this.securityAdmin.updateSecurityClient.bind(this.securityAdmin),
    );
    this.routingManager.registerRoutes();
  }
}
