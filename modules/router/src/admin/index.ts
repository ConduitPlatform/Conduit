import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  ConduitString,
  TYPE,
  ConduitRouteObject,
} from '@conduitplatform/grpc-sdk';
import { RouterAdmin } from './router';
import { SecurityAdmin } from './security';
import ConduitDefaultRouter from '../Router';
import { Client } from '../models';

export class AdminHandlers {
  private readonly routerAdmin: RouterAdmin;
  private readonly securityAdmin: SecurityAdmin;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {
    this.routerAdmin = new RouterAdmin(this.grpcSdk, router);
    this.securityAdmin = new SecurityAdmin(this.grpcSdk);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getMiddlewares: this.routerAdmin.getMiddlewares.bind(this),
        getRoutes: this.routerAdmin.getRoutes.bind(this),
        createSecurityClient: this.securityAdmin.createSecurityClient.bind(this),
        deleteSecurityClient: this.securityAdmin.deleteSecurityClient.bind(this),
        getSecurityClients: this.securityAdmin.getSecurityClients.bind(this),
        updateSecurityClient: this.securityAdmin.updateSecurityClient.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.log('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/router/middlewares',
          action: ConduitRouteActions.GET,
          description: `Returns middleware.`,
        },
        new ConduitRouteReturnDefinition('GetMiddlewares', {
          response: TYPE.JSON,
        }),
        'getMiddlewares',
      ),
      constructConduitRoute(
        {
          path: '/routes',
          action: ConduitRouteActions.GET,
          description: `Returns available routes.`,
        },
        new ConduitRouteReturnDefinition('GetRoutes', {
          response: TYPE.JSON,
        }),
        'getRoutes',
      ),
      constructConduitRoute(
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
        'createSecurityClient',
      ),
      constructConduitRoute(
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
        'deleteSecurityClient',
      ),
      constructConduitRoute(
        {
          path: '/security/client',
          action: ConduitRouteActions.GET,
          description: `Returns security clients.`,
        },
        new ConduitRouteReturnDefinition('GetSecurityClients', {
          clients: [Client.name],
        }),
        'getSecurityClients',
      ),
      constructConduitRoute(
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
        'updateSecurityClient',
      ),
    ];
  }
}
