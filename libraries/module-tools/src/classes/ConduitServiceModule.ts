import path from 'path';
import { EventEmitter } from 'events';
import { camelCase } from 'lodash';
import { ServerWritableStream } from '@grpc/grpc-js';
import { GrpcServer } from './GrpcServer.js';
import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  ModuleProtoUtils,
  GrpcHealthCheckProtoUtils,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';

import { RoutingManager } from '../routing/index.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export abstract class ConduitServiceModule {
  protected readonly _moduleName: string;
  protected _serviceName?: string;
  protected _address!: string; // external address:port of service (LoadBalancer)
  protected grpcServer!: GrpcServer;
  protected readonly events: EventEmitter = new EventEmitter();
  private _serviceHealthState: HealthCheckStatus = HealthCheckStatus.SERVING; // default for health-agnostic modules

  protected constructor(moduleName: string) {
    this._moduleName = camelCase(moduleName);
  }

  private _registered = false;
  set registered(registered: boolean) {
    this._registered = registered;
  }

  protected _port!: string; // port to bring up gRPC service

  get port(): string {
    return this._port;
  }

  private _grpcSdk: ConduitGrpcSdk | undefined;

  public get grpcSdk(): ConduitGrpcSdk {
    if (!this._grpcSdk) throw new Error('grpcSdk not defined yet');
    return this._grpcSdk;
  }

  public set grpcSdk(grpcSdk: ConduitGrpcSdk) {
    if (this._grpcSdk) throw new Error('grpcSdk already defined');
    this._grpcSdk = grpcSdk;
  }

  get healthState() {
    return this._serviceHealthState;
  }

  updateHealth(state: HealthCheckStatus, init = false) {
    if (
      (state === HealthCheckStatus.UNKNOWN && !init) ||
      state === HealthCheckStatus.SERVICE_UNKNOWN
    ) {
      throw new Error(
        `Cannot explicitly set gRPC health state to ${HealthCheckStatus[state]}`,
      );
    }
    if (!init) {
      ConduitGrpcSdk.Metrics?.set(
        'module_health_state',
        state === HealthCheckStatus.SERVING ? 1 : 0,
      );
    }
    if (init) {
      this._serviceHealthState = state;
      return;
    }
    if (this._serviceHealthState !== state) {
      this._serviceHealthState = state;
      // do not emit health updates until registered
      if (this._registered) {
        this.events.emit(`grpc-health-change:${this._serviceName}`, state);
        this._grpcSdk?.config.moduleHealthProbe(this._moduleName, this._address);
      }
    }
  }

  healthCheck(
    call: GrpcRequest<GrpcHealthCheckProtoUtils.HealthCheckRequest>,
    callback: GrpcCallback<GrpcHealthCheckProtoUtils.HealthCheckResponse>,
  ) {
    const service = call.request.service.substring(call.request.service.indexOf('.') + 1);
    if (service && service !== this._serviceName) {
      callback(null, {
        status:
          HealthCheckStatus.SERVICE_UNKNOWN as unknown as GrpcHealthCheckProtoUtils.HealthCheckResponse_ServingStatus,
      });
    } else {
      if (!this._registered) {
        return callback(null, {
          status: GrpcHealthCheckProtoUtils.HealthCheckResponse_ServingStatus.UNKNOWN,
        });
      }
      callback(null, {
        status: this
          ._serviceHealthState as unknown as GrpcHealthCheckProtoUtils.HealthCheckResponse_ServingStatus,
      });
    }
  }

  healthWatch(
    call: ServerWritableStream<
      GrpcHealthCheckProtoUtils.HealthCheckRequest,
      GrpcHealthCheckProtoUtils.HealthCheckResponse
    >,
  ) {
    const service = call.request.service.substring(call.request.service.indexOf('.') + 1);
    if (service && service !== this._serviceName) {
      call.write({
        status:
          HealthCheckStatus.SERVICE_UNKNOWN as unknown as GrpcHealthCheckProtoUtils.HealthCheckResponse_ServingStatus,
      });
    } else {
      this.events.on(
        `grpc-health-change:${this._serviceName}`,
        (status: HealthCheckStatus) => {
          call.write({
            status:
              status as unknown as GrpcHealthCheckProtoUtils.HealthCheckResponse_ServingStatus,
          });
        },
      );
    }
  }

  abstract setConfig(
    call: GrpcRequest<ModuleProtoUtils.SetConfigRequest>,
    callback: GrpcResponse<ModuleProtoUtils.SetConfigResponse>,
  ): Promise<void>;

  protected async addHealthCheckService() {
    await this.grpcServer.addService(
      path.resolve(__dirname, './grpc_health_check.proto'),
      'grpc.health.v1.Health',
      {
        Check: this.healthCheck.bind(this),
        Watch: this.healthWatch.bind(this),
      },
    );
  }

  protected async addModuleService() {
    await this.grpcServer.addService(
      path.resolve(__dirname, './module.proto'),
      'conduit.module.v1.ConduitModule',
      {
        SetConfig: this.setConfig.bind(this),
      },
    );
    await this.grpcServer.addService(
      path.resolve(__dirname, './module.proto'),
      'conduit.module.v1.ClientRouter',
      {
        Route: RoutingManager.ClientController.handleRequest.bind(
          RoutingManager.ClientController,
        ),
        SocketRoute: RoutingManager.ClientController.handleRequest.bind(
          RoutingManager.ClientController,
        ),
      },
    );
    await this.grpcServer.addService(
      path.resolve(__dirname, './module.proto'),
      'conduit.module.v1.AdminRouter',
      {
        Route: RoutingManager.AdminController.handleRequest.bind(
          RoutingManager.AdminController,
        ),
        SocketRoute: RoutingManager.AdminController.handleRequest.bind(
          RoutingManager.AdminController,
        ),
      },
    );
  }
}
