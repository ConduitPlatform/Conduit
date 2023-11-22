import ConduitGrpcSdk, { HealthCheckStatus } from '@conduitplatform/grpc-sdk';
import { ServiceRegistry } from './ServiceRegistry';
import { linearBackoffTimeout } from '@conduitplatform/module-tools';
import { EventEmitter } from 'events';

export class ServiceMonitor {
  private static _instance: ServiceMonitor;
  private readonly moduleHealth: {
    [module: string]: { address: string; timestamp: number; status: HealthCheckStatus };
  } = {};
  private readonly _serviceRegistry = ServiceRegistry.getInstance();
  private servingStatusUpdate: boolean = false;
  private monitorIntervalMs = 5000;
  private serviceReconnectionInitMs = 500;
  private serviceReconnectionRetries = 10;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly moduleRegister: EventEmitter,
  ) {}

  public static getInstance(grpcSdk?: ConduitGrpcSdk, moduleRegister?: EventEmitter) {
    if ((!grpcSdk || !moduleRegister) && !this._instance) {
      throw new Error('ServiceMonitor not initialized');
    }
    if (!this._instance) {
      this._instance = new ServiceMonitor(grpcSdk!, moduleRegister!);
    }
    return this._instance;
  }

  beginMonitors() {
    if (process.env.DEBUG__DISABLE_SERVICE_REMOVAL === 'true') {
      ConduitGrpcSdk.Logger.warn(
        'Service discovery module removal disabled for Debugging!',
      );
    } else {
      const specifiedInterval = parseInt(process.env.SERVICE_MONITOR_INTERVAL_MS ?? '');
      const specifiedRetries = parseInt(process.env.SERVICE_RECONN_RETRIES ?? '');
      const specifiedRetryInit = parseInt(process.env.SERVICE_RECONN_INIT_MS ?? '');
      if (!isNaN(specifiedRetryInit)) this.serviceReconnectionInitMs = specifiedRetryInit;
      if (!isNaN(specifiedInterval)) this.monitorIntervalMs = specifiedInterval;
      if (!isNaN(specifiedRetries)) this.serviceReconnectionRetries = specifiedRetries;
      ConduitGrpcSdk.Logger.log(
        `Service discovery monitoring interval set to ${this.monitorIntervalMs}ms`,
      );
      setInterval(() => {
        this.monitorModules().then();
      }, this.monitorIntervalMs);
    }
  }

  /*
   * Health checks target module service, updating its health state.
   * Any services that do not provide a gRPC health check service are assumed to be healthy.
   * Used by healthCheckRegisteredModules(), reviveService()
   */
  private async healthCheckService(module: string, address: string) {
    const healthClient = this.grpcSdk.getHealthClient(module);
    let status = HealthCheckStatus.SERVING;
    if (healthClient) {
      status = await healthClient
        .check({})
        .then(res => res.status as unknown as HealthCheckStatus);
    }
    const isRegistered = Object.keys(this.moduleHealth).includes(module);
    if (!isRegistered && status === HealthCheckStatus.SERVICE_UNKNOWN) return;
    this.updateModuleHealth(module, address, status);
    return status;
  }

  handleUnresponsiveModule(
    moduleName: string,
    moduleUrl: string,
    status: HealthCheckStatus,
  ) {
    const isRegistered = Object.keys(this.moduleHealth).includes(moduleName);
    if (!isRegistered && status === HealthCheckStatus.SERVICE_UNKNOWN) {
      ConduitGrpcSdk.Logger.info(
        `SD/health: unresponsive ${moduleName} ${moduleUrl} with no health history`,
      );
      return;
    }

    ConduitGrpcSdk.Logger.log(`SD/health: update ${moduleName} ${moduleUrl} unknown`);
    this.grpcSdk.updateModuleHealth(moduleName, false);
    // Deregister Unresponsive Module
    delete this.moduleHealth[moduleName];
    this._serviceRegistry.removeModule(moduleName);
    this.servingStatusUpdate = true;
    this.reviveService(moduleName, moduleUrl);
  }

  updateModuleHealth(
    moduleName: string,
    moduleUrl: string,
    moduleStatus: HealthCheckStatus,
    broadcast = true,
  ) {
    if (moduleStatus === HealthCheckStatus.SERVICE_UNKNOWN) {
      return this.handleUnresponsiveModule(moduleName, moduleUrl, moduleStatus);
    }

    let module = this._serviceRegistry.getModule(moduleName);
    if (!module) {
      module = {
        address: moduleUrl,
        serving: moduleStatus === HealthCheckStatus.SERVING,
      };
      ConduitGrpcSdk.Logger.log(
        `SD/health: update unregistered module ${moduleName} ${moduleUrl} ${moduleStatus}`,
      );
      this._serviceRegistry.updateModule(moduleName, module);
      this.servingStatusUpdate = true;
    } else {
      const prevStatus = module.serving;
      ConduitGrpcSdk.Logger.log(
        `SD/health: update registered module ${moduleName} ${moduleUrl} to ${moduleStatus} from serving: ${prevStatus}`,
      );
      module.serving = moduleStatus === HealthCheckStatus.SERVING;
      if (!this.servingStatusUpdate && prevStatus !== module.serving && broadcast) {
        this.servingStatusUpdate = true;
      }
    }
    this.grpcSdk.updateModuleHealth(
      moduleName,
      moduleStatus === HealthCheckStatus.SERVING,
    );
    this._serviceRegistry.updateModule(moduleName, module);
    this.moduleHealth[moduleName] = {
      address: moduleUrl,
      timestamp: Date.now(),
      status: moduleStatus,
    };
  }

  /*
   * Attempt to reconnect to a recently removed module service.
   * Retries using linear backoff.
   */
  private reviveService(name: string, address: string) {
    const onTry = (stop: () => void) => {
      if (Object.keys(this.moduleHealth).includes(name)) {
        stop();
        ConduitGrpcSdk.Logger.log(`SD/health/revive: found healthy ${name} ${address}`);
      } else {
        this.healthCheckService(name, address)
          .then(() => {
            ConduitGrpcSdk.Logger.log(
              `SD/health/revive: check completed ${name} ${address}`,
            );
          })
          .catch(() => {
            ConduitGrpcSdk.Logger.log(
              `SD/health/revive: check failed ${name} ${address}`,
            );
          });
      }
    };
    const onFailure = () => {
      this.grpcSdk.getModule(name)?.closeConnection();
      ConduitGrpcSdk.Logger.log(
        `SD/health/revive: check connection closed  ${name} ${address}`,
      );
    };
    linearBackoffTimeout(
      onTry,
      this.serviceReconnectionInitMs,
      this.serviceReconnectionRetries,
      onFailure,
    );
  }

  private async monitorModules() {
    for (const module of this._serviceRegistry.getRegisteredModules()) {
      const registeredModule = this._serviceRegistry.getModule(module)!;
      try {
        await this.healthCheckService(module, registeredModule.address);
      } catch (e) {
        this.handleUnresponsiveModule(
          module,
          registeredModule.address,
          HealthCheckStatus.SERVICE_UNKNOWN,
        );
      }
    }
    if (this.servingStatusUpdate) {
      this.moduleRegister.emit('serving-modules-update');
      this.servingStatusUpdate = false;
    }
  }
}
