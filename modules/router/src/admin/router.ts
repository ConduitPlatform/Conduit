import ConduitGrpcSdk, {
  GrpcError,
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
    const { sort } = call.request.params;
    if (!isNil(sort) && sort !== 'name' && sort !== '-name')
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid value for sort parameter.');
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
    if (sort === 'name') response = response.sort((a, b) => a.localeCompare(b));
    else if (sort === '-name') response = response.sort((a, b) => b.localeCompare(a));
    return Array.from(new Set(response));
  }

  async getRoutes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    let response: any[] = [];
    if (!isNil(sort) && sort !== 'name' && sort !== '-name')
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid value for sort parameter.');
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
    if (sort === 'name') response = response.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === '-name')
      response = response.sort((a, b) => b.name.localeCompare(a.name));
    return response;
  }
}
