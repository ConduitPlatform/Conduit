import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { AuthUtils } from '../utils/auth';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { Service } from '../models';

export class ServiceAdmin {
  private database: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    self.grpcSdk.waitForExistence('database-provider').then((r) => {
      self.database = self.grpcSdk.databaseProvider!;
    });
  }

  async getServices(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit } = call.request.params;
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const services: Service[] = await Service.getInstance().findMany(
      {},
      undefined,
      skipNumber,
      limitNumber
    );
    const count: number = await Service.getInstance().countDocuments({});

    return { services, count };
  }

  async createService(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name } = call.request.params;

    if (isNil(name)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Service name is required');
    }

    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);

    await Service.getInstance().create({ name, hashedToken });

    this.grpcSdk.bus?.publish('authentication:create:service', JSON.stringify({ name }));

    return { name, token };
  }

  async deleteService(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;

    if (isNil(id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Service id is required');
    }

    await Service.getInstance().deleteOne({ _id: id });

    this.grpcSdk.bus?.publish('authentication:delete:service', JSON.stringify({ id }));

    return 'OK';
  }

  async renewToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { serviceId } = call.request.params;

    if (isNil(serviceId)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Service id is required');
    }

    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);

    let service: Service | null = await Service.getInstance().findByIdAndUpdate(
      serviceId,
      { hashedToken },
      true
    );

    if (isNil(service)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Service not found');
    }
    return { name: service.name, token };
  }
}
