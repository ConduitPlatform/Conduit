import ConduitGrpcSdk, { UnparsedRouterResponse } from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import ConduitDefaultRouter from '../Router';

export class RouterAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {}

  async getMiddlewares(): Promise<UnparsedRouterResponse> {
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

  async getRoutes(): Promise<UnparsedRouterResponse> {
    const response: any[] = [];
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
    return response;
  }
}
