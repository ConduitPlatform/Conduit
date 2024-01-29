import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { RouterAdmin } from './router.js';
import { SecurityAdmin } from './security.js';
import ConduitDefaultRouter from '../Router.js';
import { Client, RouterProxyRoute } from '../models/index.js';

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
        path: '/router/route-middlewares',
        action: ConduitRouteActions.GET,
        description: `Returns the middleware of an app route.`,
        queryParams: {
          path: ConduitString.Required,
          action: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('GetAppRouteMiddleware', {
        middlewares: [TYPE.String],
      }),
      this.routerAdmin.getRouteMiddlewares.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/router/patch-middleware',
        action: ConduitRouteActions.PATCH,
        description: `Patches the middleware of an app route.`,
        queryParams: {
          path: ConduitString.Required,
          action: ConduitString.Required,
        },
        bodyParams: {
          middlewares: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('PatchAppMiddleware', 'String'),
      this.routerAdmin.patchRouteMiddlewares.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/routes',
        action: ConduitRouteActions.GET,
        description: `Returns available routes.`,
      },
      new ConduitRouteReturnDefinition('GetRoutes', {
        response: TYPE.JSON,
      }),
      this.routerAdmin.getRoutes.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/proxy',
        action: ConduitRouteActions.GET,
        description: `Returns proxy routes.`,
        queryParams: {
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          sort: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetProxyRoutes', {
        response: TYPE.JSON,
      }),
      this.routerAdmin.getProxyRoutes.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/proxy/:id',
        action: ConduitRouteActions.GET,
        description: `Returns proxy route by id.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('GetProxyRouteById', RouterProxyRoute.name),
      this.routerAdmin.getProxyRoute.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/proxy',
        action: ConduitRouteActions.POST,
        description: `Creates a new proxy route.`,
        bodyParams: {
          path: ConduitString.Required,
          target: ConduitString.Required,
          action: ConduitString.Required,
          routeDescription: ConduitString.Optional,
          middlewares: [ConduitString.Optional],
          proxyMiddlewareOptions: ConduitJson.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CreateProxyRoute', {
        message: ConduitString.Required,
      }),
      this.routerAdmin.createProxyRoute.bind(this.routerAdmin),
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
          id: { type: TYPE.String, required: true },
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
    this.routingManager.route(
      {
        path: '/proxy/:id',
        urlParams: {
          id: ConduitString.Required,
        },
        action: ConduitRouteActions.UPDATE,
        description: `Updates a proxy route.`,
        bodyParams: {
          path: ConduitString.Optional,
          target: ConduitString.Optional,
          action: ConduitString.Optional,
          routeDescription: ConduitString.Optional,
          middlewares: [ConduitString.Optional],
          proxyMiddlewareOptions: ConduitJson.Optional,
        },
      },
      new ConduitRouteReturnDefinition('UpdateProxyRoute', RouterProxyRoute.name),
      this.routerAdmin.updateProxyRoute.bind(this.routerAdmin),
    );
    this.routingManager.route(
      {
        path: '/proxy/:id',
        urlParams: {
          id: ConduitString.Required,
        },
        action: ConduitRouteActions.DELETE,
        description: `Deletes a proxy route.`,
      },
      new ConduitRouteReturnDefinition('DeleteProxyRoute', {
        message: ConduitString.Required,
      }),
      this.routerAdmin.deleteProxyRoute.bind(this.routerAdmin),
    );
    this.routingManager.registerRoutes();
  }
}
