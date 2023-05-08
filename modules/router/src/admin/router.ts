import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  GrpcError,
  IConduitLogger,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitDefaultRouter from '../Router';
import { RouterProxyRoute } from '../models';
import { ProxyRouteT } from '@conduitplatform/hermes';

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
    const { sortByName } = call.request.params;
    let response: UntypedArray = [];
    const module = this.router.getGrpcRoutes();
    (ConduitGrpcSdk.Logger as IConduitLogger).logObject(module);

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

  async getProxyRoutes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const { sort } = call.request.params;
    return RouterProxyRoute.getInstance().findMany({}, skip, limit, sort);
  }

  async getProxyRoute(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const existingProxy = await RouterProxyRoute.getInstance().findOne({ _id: id });
    if (!existingProxy) {
      throw new ConduitError(
        'NOT_FOUND',
        404,
        `A proxy route with an id of '${id}' does not exist`,
      );
    }
    return { ...existingProxy };
  }

  async createProxyRoute(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, target, action, middlewares, description, proxyMiddlewareOptions } =
      call.request.params;
    if (!this.isValidUrl(target)) {
      throw new ConduitError(
        'INVALID_ARGUMENT',
        400,
        `Target '${target}' is not a valid URL`,
      );
    }
    const existingProxy = await RouterProxyRoute.getInstance().findOne({
      path,
      target,
    });
    if (existingProxy) {
      throw new ConduitError(
        'ALREADY_EXISTS',
        401,
        `A proxy route with a path of '${path}' for target '${target}' already exists`,
      );
    }
    await RouterProxyRoute.getInstance().create({
      path,
      target,
      action,
      middlewares,
      description,
      proxyMiddlewareOptions,
    });
    await this.registerProxyRoutes(this.router);

    return 'Proxy route created';
  }

  async updateProxyRoute(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, target, action, middlewares, description, id, proxyMiddlewareOptions } =
      call.request.params;
    if (!this.isValidUrl(target)) {
      throw new ConduitError(
        'INVALID_ARGUMENT',
        400,
        `Target '${target}' is not a valid URL`,
      );
    }
    const existingProxy = await RouterProxyRoute.getInstance().findOne({
      _id: id,
    });
    if (!existingProxy) {
      throw new ConduitError(
        'NOT_FOUND',
        404,
        `A proxy route with a path of '${path}' for target '${target}' does not exist`,
      );
    }
    const updatedProxy = await RouterProxyRoute.getInstance().findByIdAndUpdate(
      existingProxy._id,
      {
        path,
        target,
        action,
        middlewares,
        description,
        proxyMiddlewareOptions,
      },
    );
    await this.registerProxyRoutes(this.router);
    return { ...updatedProxy };
  }

  async deleteProxyRoute(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const existingProxy = await RouterProxyRoute.getInstance().findOne({ _id: id });
    if (!existingProxy) {
      throw new ConduitError(
        'NOT_FOUND',
        404,
        `A proxy route with an id of '${id}' does not exist`,
      );
    }
    await RouterProxyRoute.getInstance().deleteOne({ _id: id });
    await RouterProxyRoute.getInstance().findMany({});
    const proxies = await this.getProxies();
    if (proxies.length === 0) {
      return 'Proxy route deleted';
    }
    await this.registerProxyRoutes(this.router);
    return 'Proxy route deleted';
  }

  isValidUrl(url: string) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  private async getProxies(): Promise<ProxyRouteT[]> {
    const proxyRoutes = await RouterProxyRoute.getInstance().findMany({});
    const proxies: ProxyRouteT[] = [];
    proxyRoutes.forEach(route => {
      proxies.push({
        options: {
          path: route.path,
          action: route.action,
          description: route.description,
          middlewares: route.middlewares,
        },
        proxy: {
          target: route.target,
          ...route.proxyMiddlewareOptions,
        },
      });
    });
    return proxies;
  }

  private async registerProxyRoutes(router: ConduitDefaultRouter) {
    const proxies = await this.getProxies();
    router.internalRegisterRoute(undefined, proxies, 'router', 'router');
  }
}
