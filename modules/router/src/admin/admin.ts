import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  ConduitString,
  TYPE,
  ConduitRouteObject,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { SecurityAdmin } from './security';
import ConduitDefaultRouter from '../Router';
import { Client } from '../models';

export class AdminHandlers {
  private readonly securityAdmin: SecurityAdmin;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {
    this.securityAdmin = new SecurityAdmin(this.grpcSdk);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getMiddlewares: this.getMiddlewares.bind(this),
        getRoutes: this.getRoutes.bind(this),
        createSecurityClient: this.securityAdmin.createSecurityClient.bind(this),
        deleteSecurityClient: this.securityAdmin.deleteSecurityClient.bind(this),
        getSecurityClient: this.securityAdmin.getSecurityClient.bind(this),
        updateSecurityClient: this.securityAdmin.updateSecurityClient.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      // User Routes
      constructConduitRoute(
        {
          path: '/router/middlewares',
          action: ConduitRouteActions.GET,
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
          bodyParams: {
            platform: ConduitString.Required,
            domain: ConduitString.Optional,
            alias: ConduitString.Optional,
            notes: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('CreateSecurityClient', {
          id: ConduitString.Required,
          clientId: ConduitString.Required,
          clientSecret: ConduitString.Required,
          platform: ConduitString.Required,
          domain: ConduitString.Optional,
          alias: ConduitString.Optional,
          notes: ConduitString.Optional,
        }),
        'createSecurityClient',
      ),
      constructConduitRoute(
        {
          path: '/security/client/:id',
          action: ConduitRouteActions.DELETE,
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
        },
        new ConduitRouteReturnDefinition('GetSecurityClient', {
          clients: [Client.getInstance().fields],
        }),
        'getSecurityClient',
      ),
      constructConduitRoute(
        {
          path: '/security/client/:id',
          urlParams: {
            id: ConduitString.Required,
          },
          action: ConduitRouteActions.UPDATE,
          bodyParams: {
            domain: ConduitString.Optional,
            alias: ConduitString.Optional,
            notes: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('UpdateSecurityClient', {
          id: ConduitString.Required,
          clientId: ConduitString.Required,
          platform: ConduitString.Optional,
          domain: ConduitString.Optional,
          alias: ConduitString.Optional,
          notes: ConduitString.Optional,
        }),
        'updateSecurityClient',
      ),
    ];
  }

  async getMiddlewares(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const response: string[] = [];
    const module = this.router.getGrpcRoutes();
    Object.keys(module).forEach((url: string) => {
      module[url].forEach((item: any) => {
        if (
          item.returns == null &&
          !isNil(item.grpcFunction) &&
          item.grpcFunction !== ''
        ) {
          response.push(item.grpcFunction);
        }
      });
    });
    return Array.from(new Set(response));
  }

  async getRoutes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const response: any[] = [];
    const module = this.router.getGrpcRoutes();
    console.log(module);
    Object.keys(module).forEach((url: string) => {
      module[url].forEach((item: any) => {
        response.push({
          name: item.grpcFunction,
          action: item.options.action,
          path: item.options.path,
        });
      });
    });
    return { result: response }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
  }
}
