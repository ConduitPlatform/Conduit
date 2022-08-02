import { ConduitCommons } from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  HealthCheckStatus,
  GrpcServer as ConduitGrpcServer,
  GrpcRequest,
  GrpcCallback,
} from '@conduitplatform/grpc-sdk';
import AdminModule from '@conduitplatform/admin';
import { EventEmitter } from 'events';
import path from 'path';
import AppConfigSchema from './config';
import CoreConfigSchema from './config/config';
import { ServerWritableStream } from '@grpc/grpc-js';
import ConfigManager from './config-manager';
import convict from 'convict';

const CORE_SERVICES = ['Config', 'Admin'];

export class GrpcServer {
  private readonly server: ConduitGrpcServer;
  private readonly events: EventEmitter;
  private _grpcSdk: ConduitGrpcSdk;
  private _serviceHealthState: HealthCheckStatus = HealthCheckStatus.UNKNOWN;
  private _initialized = false;

  get initialized() {
    return this._initialized;
  }

  get internalGrpc() {
    return this.server;
  }

  get grpcSdk() {
    return this._grpcSdk;
  }

  constructor(private readonly commons: ConduitCommons, private readonly port: number) {
    this.events = new EventEmitter();
    this.events.setMaxListeners(150);
    this.server = new ConduitGrpcServer(this.port.toString());
    this.server
      .createNewServer(true)
      .then(port => {
        const _url = '0.0.0.0:' + port.toString();
        this._grpcSdk = new ConduitGrpcSdk(
          _url,
          () => {
            return this._serviceHealthState;
          },
          'core',
          false,
        );
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

  private async bootstrapSdkComponents() {
    this.commons.registerAdmin(new AdminModule(this.commons, this._grpcSdk));
    this.initializeMetrics();
    this._grpcSdk
      .waitForExistence('router')
      .then(() => Core.getInstance().httpServer.initialize(this.grpcSdk, this.server))
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });

    this._grpcSdk
      .waitForExistence('database')
      .then(() => this.commons.getConfigManager().registerAppConfig())
      .catch(e => {
        ConduitGrpcSdk.Logger.error(e.message);
      });
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
      this.grpcSdk.initializeDefaultMetrics();
    }
  }

  private getServiceHealthState(service: string) {
    service = service.replace('conduit.core.', '');
    if (service && !CORE_SERVICES.includes(service)) {
      return HealthCheckStatus.SERVICE_UNKNOWN;
    }
    return this._serviceHealthState;
  }

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
    ConduitGrpcSdk.Metrics.set(
      'module_health_state',
      state === HealthCheckStatus.SERVING ? 1 : 0,
    );
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

  get sdk() {
    return this._grpcSdk;
  }
}
