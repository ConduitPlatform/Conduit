import ConduitGrpcSdk, {
  ConduitRouteActions,
  GrpcError,
  MiddlewareOrder,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import ConduitDefaultRouter from '../Router';
import { status } from '@grpc/grpc-js';

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

  async injectMiddleware(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, action, middlewareName, order } = call.request.params;
    if (!(action in ConduitRouteActions)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
    }
    if (Math.abs(order) !== 1) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Order should be 1 or -1');
    }
    const middlewareOrder = order === 1 ? MiddlewareOrder.FIRST : MiddlewareOrder.LAST;
    this.grpcSdk.createModuleClient('router', process.env.SERVICE_IP!);
    await this.grpcSdk
      .router!.patchMiddleware(path, action, middlewareName, false, middlewareOrder)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return 'Middleware injected successfully';
  }

  async removeMiddleware(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, action, middlewareName } = call.request.params;
    if (!(action in ConduitRouteActions)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
    }
    this.grpcSdk.createModuleClient('router', process.env.SERVICE_IP!);
    await this.grpcSdk
      .router!.patchMiddleware(path, action, middlewareName, true)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return 'Middleware removed successfully';
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
