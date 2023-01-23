import ConduitGrpcSdk, {
  ConduitError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import ConduitDefaultRouter from '../Router';
import { ProxyRoute } from '../models';

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

  async createProxyRoute(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, target } = call.request.params;
    if (!this.isValidUrl(target)) {
      throw new ConduitError(
        'INVALID_ARGUMENT',
        400,
        `Target '${target}' is not a valid URL`,
      );
    }
    const existingProxy = await ProxyRoute.getInstance().findOne({
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
    const newProxy = await ProxyRoute.getInstance().create({
      path,
      target,
    });

    this.router.registerProxyRoute(newProxy.path, newProxy.target);
    return `Proxy route created for path '${path}' and target '${target}'`;
  }

  async updateProxyRoute(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { path, target } = call.request.params;
    if (!this.isValidUrl(target)) {
      throw new ConduitError(
        'INVALID_ARGUMENT',
        400,
        `Target '${target}' is not a valid URL`,
      );
    }
    const existingProxy = await ProxyRoute.getInstance().findOne({
      path,
      target,
    });
    if (!existingProxy) {
      throw new ConduitError(
        'NOT_FOUND',
        404,
        `A proxy route with a path of '${path}' for target '${target}' does not exist`,
      );
    }
    const updatedProxy = await ProxyRoute.getInstance().findByIdAndUpdate(
      existingProxy._id,
      {
        path,
        target,
      },
    );

    return { ...updatedProxy };
  }

  isValidUrl(url: string) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
}
