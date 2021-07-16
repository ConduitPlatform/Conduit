import ConduitGrpcSdk, {
  GrpcError,
  RouterRequest,
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

  async getServices(call: RouterRequest) {
    const { skip, limit } = JSON.parse(call.request.params);
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

    return { result: JSON.stringify({ services, count }) };
  }

  async createService(call: RouterRequest) {
    const { name } = JSON.parse(call.request.params);

    if (isNil(name)) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Service name is required');
    }

    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token);

    await this.database.create('Service', { name, hashedToken });

    this.grpcSdk.bus?.publish('authentication:create:service', JSON.stringify({ name }));

    return { result: JSON.stringify({ name, token }) };
  }

  async deleteService(call: RouterRequest) {
    const { id } = JSON.parse(call.request.params);

    if (isNil(id)) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Service id is required');
    }

    await this.database.deleteOne('Service', { _id: id });

    this.grpcSdk.bus?.publish('authentication:delete:service', JSON.stringify({ id }));

    return { result: 'OK' };
  }

  async renewToken(call: RouterRequest) {
    const { serviceId } = JSON.parse(call.request.params);

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

    return { result: JSON.stringify({ name: service.name, token }) };
  }
}
