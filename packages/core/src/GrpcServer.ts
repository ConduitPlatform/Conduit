import { ConduitCommons } from '@conduitplatform/commons';
import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import {
  GrpcServer as ConduitGrpcServer,
  initializeSdk,
} from '@conduitplatform/module-tools';
import AdminModule from '@conduitplatform/admin';
import { EventEmitter } from 'events';
import path from 'path';
import AppConfigSchema from './config/index.js';
import CoreConfigSchema from './config/config.js';
import { ServerWritableStream } from '@grpc/grpc-js';
import ConfigManager from './config-manager/index.js';
import convict from 'convict';
import { fileURLToPath } from 'node:url';

const CORE_SERVICES = ['Config', 'Admin'];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class GrpcServer {
  private readonly server: ConduitGrpcServer;
  private readonly events: EventEmitter;

  constructor(
    private readonly commons: ConduitCommons,
    private readonly port: number,
  ) {
    this.events = new EventEmitter();
    this.events.setMaxListeners(150);
    this.server = new ConduitGrpcServer(this.port.toString());
    this.server
      .createNewServer(true)
      .then(port => {
        const _url = '0.0.0.0:' + port.toString();
        this._grpcSdk = initializeSdk(_url, 'core', false, () => {
          return this._serviceHealthState;
        });
        this._grpcSdk.initialize().then(async () => {
          await this._grpcSdk.initializeEventBus();
          this.commons.registerConfigManager(
            new ConfigManager(this._grpcSdk, this.commons),
          );
          await this.commons.getConfigManager().initialize(this.server);
          await this.bootstrapSdkComponents();
          this.server.start();
          await this.commons.getAdmin().subscribeToBusEvents();
          ConduitGrpcSdk.Logger.log(`gRPC server listening on: ${_url}`);
        });
      })
      .then(() => {
        return this.addHealthService();
      })
      .then()
      .catch(err => {
        ConduitGrpcSdk.Logger.error(err);
        process.exit(-1);
      });
  }

  private _grpcSdk: ConduitGrpcSdk;

  get grpcSdk() {
    return this._grpcSdk;
  }

  private _initialized = false;

  get initialized() {
    return this._initialized;
  }

  get internalGrpc() {
    return this.server;
  }

  get sdk() {
    return this._grpcSdk;
  }

  private _serviceHealthState: HealthCheckStatus = HealthCheckStatus.UNKNOWN;

  private set serviceHealthState(
    state: Exclude<
      HealthCheckStatus,
      HealthCheckStatus.SERVICE_UNKNOWN | HealthCheckStatus.UNKNOWN
    >,
  ) {
    if (this._serviceHealthState !== state) {
      this.events.emit('grpc-health-change:Core', state);
    }
    this._serviceHealthState = state;
    ConduitGrpcSdk.Metrics?.set(
      'module_health_state',
      state === HealthCheckStatus.SERVING ? 1 : 0,
    );
  }

  private async bootstrapSdkComponents() {
    this.commons.registerAdmin(new AdminModule(this.commons, this._grpcSdk));
    this.initializeMetrics();
    this._grpcSdk
      .waitForExistence('database')
      .then(() => this.commons.getConfigManager().registerAppConfig());
    await this.commons
      .getConfigManager()
      .configurePackage(
        'core',
        convict(AppConfigSchema).getProperties(),
        CoreConfigSchema,
      );

    await this.commons.getAdmin().initialize(this.server);
    this.commons.getConfigManager().initConfigAdminRoutes();

    this._initialized = true;
    this.serviceHealthState = HealthCheckStatus.SERVING;
  }

  private initializeMetrics() {
    if (process.env['METRICS_PORT']) {
      ConduitGrpcSdk.Metrics?.initializeDefaultMetrics();
    }
  }

  private getServiceHealthState(service: string) {
    service = service.replace('conduit.core.', '');
    if (service && !CORE_SERVICES.includes(service)) {
      return HealthCheckStatus.SERVICE_UNKNOWN;
    }
    return this._serviceHealthState;
  }

  private addHealthService() {
    return this.server.addService(
      path.resolve(__dirname, './grpc_health_check.proto'),
      'grpc.health.v1.Health',
      {
        Check: this.healthCheck.bind(this),
        Watch: this.healthWatch.bind(this),
      },
    );
  }

  private healthCheck(
    call: GrpcRequest<{ service: string }>,
    callback: GrpcCallback<{ status: HealthCheckStatus }>,
  ) {
    callback(null, { status: this.getServiceHealthState(call.request.service) });
  }

  private healthWatch(
    call: ServerWritableStream<{ service: string }, { status: HealthCheckStatus }>,
  ) {
    const healthState = this.getServiceHealthState(call.request.service);
    if (healthState === HealthCheckStatus.SERVICE_UNKNOWN) {
      call.write({ status: HealthCheckStatus.SERVICE_UNKNOWN });
    } else {
      this.events.on('grpc-health-change:Core', (status: HealthCheckStatus) => {
        call.write({ status });
      });
    }
  }
}
