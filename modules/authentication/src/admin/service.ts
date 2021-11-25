import ConduitGrpcSdk, {
  DatabaseProvider,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { AuthUtils } from '../utils/auth';
import { isNil } from 'lodash';
import { Service } from '../models';

export class ServiceAdmin {
  private readonly database: DatabaseProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider!;
    Service.getInstance(this.database);
  }

  async getManyServices(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(call.request.params.skip)) {
      skipNumber = Number.parseInt(call.request.params.skip as string);
    }
    if (!isNil(call.request.params.limit)) {
      limitNumber = Number.parseInt(call.request.params.limit as string);
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
    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);
    const serviceExists = await Service.getInstance().findOne({ name });
    if (serviceExists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Service already exists');
    }
    await Service.getInstance().create({ name, hashedToken });
    this.grpcSdk.bus?.publish('authentication:create:service', JSON.stringify({ name }));
    return { name, token };
  }

  async deleteService(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    await Service.getInstance().deleteOne({ _id: call.request.params.id });
    this.grpcSdk.bus?.publish('authentication:delete:service', JSON.stringify({ id: call.request.params.id }));
    return 'OK';
  }

  async renewToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);
    let service: Service | null = await Service.getInstance().findByIdAndUpdate(
      call.request.params.serviceId,
      { hashedToken },
      true
    );
    if (isNil(service)) {
      throw new GrpcError(status.NOT_FOUND, 'Service does not exist');
    }
    return { name: service.name, token };
  }
}
