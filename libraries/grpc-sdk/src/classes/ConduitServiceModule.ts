import ConduitGrpcSdk, {
  GrpcServer,
  HealthCheckStatus,
} from '..';
import path from 'path';
import { EventEmitter } from 'events';
import { camelCase } from 'lodash';
import { GrpcRequest } from '../types';
import { HealthCheckRequest, HealthCheckResponse, HealthCheckResponse_ServingStatus } from '../protoUtils/grpc_health_check';
import { GrpcCallback } from '../interfaces';
import { ServerWritableStream } from '@grpc/grpc-js';

export abstract class ConduitServiceModule {
  protected readonly _moduleName: string;
  protected _serviceName?: string;
  protected _port!: string;
  protected grpcServer!: GrpcServer;
  private _grpcSdk: ConduitGrpcSdk | undefined;
  private _serviceHealthState: HealthCheckStatus = HealthCheckStatus.SERVING; // default for health-agnostic modules
  protected readonly events: EventEmitter = new EventEmitter();

  protected constructor(moduleName: string) {
    this._moduleName = camelCase(moduleName);
  }

  get healthState() {
    return this._serviceHealthState;
  }

  public set grpcSdk(grpcSdk: ConduitGrpcSdk) {
    if (this._grpcSdk) throw new Error('grpcSdk already defined');
    this._grpcSdk = grpcSdk;
  }

  public get grpcSdk(): ConduitGrpcSdk {
    if (!this._grpcSdk) throw new Error('grpcSdk not defined yet');
    return this._grpcSdk;
  }

  get port(): string {
    return this._port;
  }

  protected async addHealthCheckService() {
    await this.grpcServer.addService(
      path.resolve(__dirname, '../../src/grpc_health_check.proto'),
      'grpc.health.v1.Health',
      {
        Check: this.healthCheck.bind(this),
        Watch: this.healthWatch.bind(this),
      }
    );
  }

  updateHealth(state: HealthCheckStatus, init = false) {
    if ((state === HealthCheckStatus.UNKNOWN && !init) || state === HealthCheckStatus.SERVICE_UNKNOWN) {
      throw new Error(`Cannot explicitly set gRPC health state to ${HealthCheckStatus[state]}`);
    }
    if (this._serviceHealthState !== state) {
      this._serviceHealthState = state;
      this.events.emit(`grpc-health-change:${this._serviceName}`, state);
    }
  }

  healthCheck(call: GrpcRequest<HealthCheckRequest>, callback: GrpcCallback<HealthCheckResponse>) {
    const service = call.request.service.substring(call.request.service.indexOf('.') + 1);
    if (service && service !== this._serviceName) {
      callback(null, { status: HealthCheckStatus.SERVICE_UNKNOWN as unknown as HealthCheckResponse_ServingStatus });
    } else {
      callback(null, { status: this._serviceHealthState as unknown as HealthCheckResponse_ServingStatus });
    }
  }

  healthWatch(call: ServerWritableStream<HealthCheckRequest,HealthCheckResponse>) {
    const service = call.request.service.substring(call.request.service.indexOf('.') + 1);
    if (service && service !== this._serviceName) {
      call.write({ status: HealthCheckStatus.SERVICE_UNKNOWN as unknown as HealthCheckResponse_ServingStatus });
    } else {
      this.events.on(`grpc-health-change:${this._serviceName}`, (status: HealthCheckStatus) => {
        call.write({ status: status as unknown as HealthCheckResponse_ServingStatus });
      });
    }
  }
}
