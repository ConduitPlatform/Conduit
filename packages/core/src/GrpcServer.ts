import { ConduitCommons } from '@conduitplatform/commons';
import ConduitGrpcSdk, { HealthCheckStatus } from '@conduitplatform/grpc-sdk';
import ConfigManager from '@conduitplatform/config';
import AdminModule from '@conduitplatform/admin';
import SecurityModule from '@conduitplatform/security';
import { ConduitDefaultRouter } from '@conduitplatform/router';
import { loadPackageDefinition, Server, ServerCredentials } from '@grpc/grpc-js';
import { Core } from './Core';
import { EventEmitter } from 'events';
import path from 'path';
import convict from './utils/config';

const protoLoader = require('@grpc/proto-loader');

const CORE_SERVICES = ['Config', 'Admin', 'Router'];

export class GrpcServer {
  private readonly server: Server;
  private readonly events: EventEmitter;
  private _serviceHealthState: HealthCheckStatus = HealthCheckStatus.UNKNOWN;
  private _initialized = false;

  get initialized() { return this._initialized; }

  constructor(
    private readonly commons: ConduitCommons,
    private readonly port: number
  ) {
    this.events = new EventEmitter();
    this.events.setMaxListeners(150);
    this.server = new Server({
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    });
    const packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './core.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    this.addHealthService();
    let _url = '0.0.0.0:' + this.port;
    this.server.bindAsync(_url, ServerCredentials.createInsecure(), (err, port) => {
      _url = '0.0.0.0:' + port.toString();
      const grpcSdk = new ConduitGrpcSdk(_url, 'core');
      grpcSdk.initialize().then(() => {
        if (err) {
          console.error(err);
          process.exit(-1);
        }
        this.server.start();
        console.log('gRPC server listening on:', _url);
        this.commons.registerConfigManager(
          new ConfigManager(
            grpcSdk,
            this.commons,
            this.server,
            packageDefinition,
            async () => {
              if (!this._initialized) {
                await grpcSdk.waitForExistence('database');
                await this.bootstrapSdkComponents(grpcSdk);
              }
            }
          )
        );
      });
    });
  }

  private async bootstrapSdkComponents(grpcSdk: ConduitGrpcSdk) {
    const packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './core.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    this.commons.registerAdmin(
      new AdminModule(
        this.commons,
        grpcSdk,
        packageDefinition,
        this.server
      )
    );
    this.commons.registerRouter(
      new ConduitDefaultRouter(
        this.commons,
        grpcSdk,
        packageDefinition,
        this.server,
        Core.getInstance().httpServer.expressApp,
      )
    );
    Core.getInstance().httpServer.initialize();
    Core.getInstance().httpServer.start();
    await this.commons.getConfigManager().registerAppConfig();
    let error;
    this.commons.getConfigManager()
      .get('core')
      .catch((err: any) => (error = err));
    if (error) {
      await this.commons
        .getConfigManager()
        .registerModulesConfig('core', convict.getProperties());
    } else {
      await this.commons
        .getConfigManager()
        .addFieldsToModule('core', convict.getProperties());
    }

    this.commons.getAdmin().initialize();
    this.commons.getConfigManager().initConfigAdminRoutes();
    this.commons.registerSecurity(new SecurityModule(this.commons, grpcSdk));

    this._initialized = true;
    this.serviceHealthState = HealthCheckStatus.SERVING;
  }

  private getServiceHealthState(service: string) {
    service = service.replace('conduit.core.', '');
    if (service && !CORE_SERVICES.includes(service)) {
     return HealthCheckStatus.SERVICE_UNKNOWN;
    }
    return this._serviceHealthState;
  }

  private set serviceHealthState(
    state: Exclude<HealthCheckStatus, HealthCheckStatus.SERVICE_UNKNOWN | HealthCheckStatus.UNKNOWN>
  ) {
    if (this._serviceHealthState !== state) {
      this.events.emit('grpc-health-change:core', state);
    }
    this._serviceHealthState = state;
  }

  private addHealthService() {
    const packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './grpc_health_check.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }
    );
    const protoDescriptor = loadPackageDefinition(packageDefinition);
    const healthService = (protoDescriptor.grpc as any).health.v1.Health.service;
    this.server.addService(healthService, {
      Check: this.healthCheck.bind(this),
      Watch: this.healthWatch.bind(this),
    });
  }

  private healthCheck(call: any, callback: any) {
    callback(null, { status: this.getServiceHealthState(call.request.service) });
  }

  private healthWatch(call: any) {
    const healthState = this.getServiceHealthState(call.request.service);
    if (healthState === HealthCheckStatus.SERVICE_UNKNOWN) {
      call.write({ status: HealthCheckStatus.SERVICE_UNKNOWN });
    } else {
      this.events.on('grpc-health-change:core', (status: HealthCheckStatus) => {
        call.write({ status });
      });
    }
  }
}
