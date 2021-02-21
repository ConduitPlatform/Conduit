import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
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

  async getServices(call: any, callback: any) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const servicesPromise = this.database.findMany(
      'Service',
      {},
      null,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments('Service', {});

    let errorMessage = null;
    const [services, count] = await Promise.all([servicesPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );

    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }

    return callback(null, { result: JSON.stringify({ services, count }) });
  }

  async createService(call: any, callback: any) {
    const { name } = JSON.parse(call.request.params);

    if (isNil(name)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Service name is required',
      });
    }

    let errorMessage = null;
    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    await this.database
      .create('Service', { name, hashedToken })
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Service creation failed',
      });
    }

    return callback(null, { result: JSON.stringify({ name, token }) });
  }

  async renewToken(call: any, callback: any) {
    const { serviceId } = JSON.parse(call.request.params);

    if (isNil(serviceId)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Service id is required',
      });
    }

    let errorMessage = null;
    const token = AuthUtils.randomToken();
    const hashedToken = await AuthUtils.hashPassword(token).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    let service = await this.database
      .findByIdAndUpdate('Service', serviceId, { hashedToken }, { new: true })
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Service update failed',
      });
    }

    return callback(null, { result: JSON.stringify({ name: service.name, token }) });
  }
}
