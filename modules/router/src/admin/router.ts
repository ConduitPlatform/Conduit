import ConduitGrpcSdk, {
  ConduitRouteActions,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import ConduitDefaultRouter from '../Router';
import { status } from '@grpc/grpc-js';
import { AppMiddleware } from '../models';

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

  getRouteMiddlewares(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, action } = call.request.params;
    if (!(action in ConduitRouteActions)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
    }
    const route = this.router.getGrpcRoute(path, action);
    if (!route) {
      throw new GrpcError(status.NOT_FOUND, 'Route not found');
    }
    return route.options.middlewares;
  }

  async patchMiddleware(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, action, middleware } = call.request.params;
    if (!(action in ConduitRouteActions)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
    }
    this.grpcSdk.createModuleClient('router', process.env.SERVICE_IP!);
    await this.grpcSdk
      .router!.patchMiddleware(path, action, middleware)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return 'Middleware patched successfully';
  }

  async getRoutes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sortByName } = call.request.params;
    let response: any[] = [];
    const module = this.router.getGrpcRoutes();
    ConduitGrpcSdk.Logger.logObject(module);

    Object.keys(module).forEach((url: string) => {
      module[url].forEach((item: any) => {
        response.push({
          name: item.grpcFunction,
          action: item.options.action,
          path: item.options.path,
        });
      });
    });
    if (!isNil(sortByName)) {
      if (sortByName) response = response.sort((a, b) => a.localeCompare(b));
      else response = response.sort((a, b) => b.localeCompare(a));
    }
    return response;
  }
}
