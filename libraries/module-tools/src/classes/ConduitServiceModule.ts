import path from 'path';
import { EventEmitter } from 'events';
import { camelCase } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { ServerWritableStream } from '@grpc/grpc-js';
import { GrpcServer } from './GrpcServer.js';
import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  HealthCheckRequest,
  HealthCheckResponse,
  HealthCheckResponse_ServingStatus,
  HealthCheckStatus,
  SetConfigRequest,
  SetConfigResponse,
  GetExportableResourcesRequest,
  GetExportableResourcesResponse,
  ExportResourcesRequest,
  ExportResourcesResponse,
  ImportResourcesRequest,
  ImportResourcesResponse,
} from '@conduitplatform/grpc-sdk';
import { RoutingManager } from '../routing/index.js';
import type {
  ExportableResource,
  ExportResult,
  ImportResult,
} from '../interfaces/ResourceExporter.js';

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
    call: GrpcRequest<HealthCheckRequest>,
    callback: GrpcCallback<HealthCheckResponse>,
  ) {
    const service = call.request.service.substring(call.request.service.indexOf('.') + 1);
    if (service && service !== this._serviceName) {
      callback(null, {
        status:
          HealthCheckStatus.SERVICE_UNKNOWN as unknown as HealthCheckResponse_ServingStatus,
      });
    } else {
      if (!this._registered) {
        return callback(null, {
          status: HealthCheckResponse_ServingStatus.UNKNOWN,
        });
      }
      callback(null, {
        status: this._serviceHealthState as unknown as HealthCheckResponse_ServingStatus,
      });
    }
  }

  healthWatch(call: ServerWritableStream<HealthCheckRequest, HealthCheckResponse>) {
    const service = call.request.service.substring(call.request.service.indexOf('.') + 1);
    if (service && service !== this._serviceName) {
      call.write({
        status:
          HealthCheckStatus.SERVICE_UNKNOWN as unknown as HealthCheckResponse_ServingStatus,
      });
    } else {
      this.events.on(
        `grpc-health-change:${this._serviceName}`,
        (status: HealthCheckStatus) => {
          call.write({
            status: status as unknown as HealthCheckResponse_ServingStatus,
          });
        },
      );
    }
  }

  abstract setConfig(
    call: GrpcRequest<SetConfigRequest>,
    callback: GrpcResponse<SetConfigResponse>,
  ): Promise<void>;

  /** Override to declare which resource types this module can export/import. Default: none. */
  protected getExportableResources(): ExportableResource[] {
    return [];
  }

  /** Override to export resources. resourceTypes empty = export all. Default: empty. */
  protected async exportResources(_resourceTypes: string[]): Promise<ExportResult> {
    return {};
  }

  /** Override to import resources. Default: no-op. */
  protected async importResources(_resources: ExportResult): Promise<ImportResult> {
    return {};
  }

  protected getExportableResourcesHandler(
    _call: GrpcRequest<GetExportableResourcesRequest>,
    callback: GrpcResponse<GetExportableResourcesResponse>,
  ): void {
    try {
      const resources = this.getExportableResources();
      callback(null, { resources: JSON.stringify(resources) });
    } catch (e) {
      callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  protected async exportResourcesHandler(
    call: GrpcRequest<ExportResourcesRequest>,
    callback: GrpcResponse<ExportResourcesResponse>,
  ): Promise<void> {
    try {
      const resourceTypes = call.request.resourceTypes ?? [];
      const data = await this.exportResources(resourceTypes);
      callback(null, { data: JSON.stringify(data) });
    } catch (e) {
      callback({ code: status.INTERNAL, message: (e as Error).message });
    }
  }

  protected async importResourcesHandler(
    call: GrpcRequest<ImportResourcesRequest>,
    callback: GrpcResponse<ImportResourcesResponse>,
  ): Promise<void> {
    try {
      const data = JSON.parse(call.request.data) as ExportResult;
      const result = await this.importResources(data);
      callback(null, { result: JSON.stringify(result) });
    } catch (e) {
      const err = e as Error;
      if (err instanceof SyntaxError) {
        callback({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid JSON in import data',
        });
      } else {
        callback({ code: status.INTERNAL, message: err.message });
      }
    }
  }

  protected async addHealthCheckService() {
    await this.grpcServer.addService(
      path.resolve(__dirname, './grpc_health_check.proto'),
      'grpc.health.v1.Health',
      {
        Check: this.healthCheck.bind(this),
        Watch: this.healthWatch.bind(this),
      },
      true,
    );
  }

  protected async addModuleService() {
    await this.grpcServer.addService(
      path.resolve(__dirname, './module.proto'),
      'conduit.module.v1.ConduitModule',
      {
        SetConfig: this.setConfig.bind(this),
        GetExportableResources: this.getExportableResourcesHandler.bind(this),
        ExportResources: this.exportResourcesHandler.bind(this),
        ImportResources: this.importResourcesHandler.bind(this),
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
