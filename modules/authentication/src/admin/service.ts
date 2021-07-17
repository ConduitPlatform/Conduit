import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { AuthUtils } from '../utils/auth';
import grpc from 'grpc';
import { isNil } from 'lodash';

export class ServiceAdmin {
  private database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    self.grpcSdk.waitForExistence('database-provider').then((r) => {
      self.database = self.grpcSdk.databaseProvider;
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

    const services = await this.database.findMany(
      'Service',
      {},
      null,
      skipNumber,
      limitNumber
    );
    const count = await this.database.countDocuments('Service', {});

    return { services, count };
  }

  async createService(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name } = call.request.params;

    if (isNil(name)) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Service name is required');
    }

    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);

    await this.database.create('Service', { name, hashedToken });

    this.grpcSdk.bus?.publish('authentication:create:service', JSON.stringify({ name }));

    return { name, token };
  }

  async deleteService(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;

    if (isNil(id)) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Service id is required');
    }

    await this.database.deleteOne('Service', { _id: id });

    this.grpcSdk.bus?.publish('authentication:delete:service', JSON.stringify({ id }));

    return 'OK';
  }

  async renewToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { serviceId } = call.request.params;

    if (isNil(serviceId)) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Service id is required');
    }

    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);

    let service = await this.database.findByIdAndUpdate(
      'Service',
      serviceId,
      { hashedToken },
      { new: true }
    );

    return { name: service.name, token };
  }
}
