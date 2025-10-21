import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  GrpcError,
  IConduitLogger,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import ConduitDefaultRouter from '../Router.js';

export class RouterAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {}

  async getMiddlewares(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sortByName } = call.request.params;
    let response: string[] = [];
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
    if (!isNil(sortByName)) {
      if (sortByName) response = response.sort((a, b) => a.localeCompare(b));
      else response = response.sort((a, b) => b.localeCompare(a));
    }
    return Array.from(new Set(response));
  }

  async getRouteMiddlewares(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, action } = call.request.params;
    if (!(action in ConduitRouteActions)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
    }
    const { url, routeIndex } = this.router.findGrpcRoute(path, action);
    const route = this.router.getGrpcRoute(url, routeIndex);
    if (!route) {
      throw new GrpcError(status.NOT_FOUND, 'Route not found');
    }
    return { middlewares: route.options.middlewares };
  }

  async patchRouteMiddlewares(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const { path, action, middlewares } = call.request.params;
    if (!(action in ConduitRouteActions)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
    }
    await this.router
      ._patchRouteMiddlewares(path, action, middlewares)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return 'Middleware patched successfully';
  }

  async getRoutes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const response: { [key: string]: any } = {};
    const module = this.router.getGrpcRoutes();
    (ConduitGrpcSdk.Logger as IConduitLogger).logObject(module);

    Object.keys(module).forEach((url: string) => {
      //get module name by taking the first string before the second slash
      const moduleName = module[url][0].options.path.split('/')[1];
      response[moduleName] = {
        moduleUrl: url,
        routes: {},
        socketRoutes: {},
        proxyRoutes: {},
        middlewares: {},
      };
      module[url].forEach(item => {
        if ((<RouteT>item).grpcFunction && (<RouteT>item).returns) {
          response[moduleName].routes[(<RouteT>item).grpcFunction] = {
            action: item.options.action,
            path: item.options.path,
            description: item.options.description,
            middlewares: item.options.middlewares,
            handler: (<RouteT>item).grpcFunction,
          };
        } else if ((<RouteT>item).grpcFunction && !(<RouteT>item).returns) {
          response[moduleName].middlewares[(<RouteT>item).grpcFunction] = {
            action: item.options.action,
            path: item.options.path,
            description: item.options.description,
            handler: (<RouteT>item).grpcFunction,
          };
        } else if ((item as any).events) {
          const eventObject = JSON.parse((item as any).events);
          response[moduleName].socketRoutes[item.options.path] = {};
          Object.keys(eventObject).forEach((event: string) => {
            response[moduleName].socketRoutes[item.options.path][event] = {
              action: item.options.action,
              description: item.options.description,
              middlewares: item.options.middlewares,
              handler: eventObject[event].handler,
            };
          });
        }
      });
    });
    return response;
  }
}
