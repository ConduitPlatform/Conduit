import { ConduitGrpcSdk, HealthCheckStatus } from '@conduitplatform/grpc-sdk';
import { ServiceRegistry } from './ServiceRegistry.js';
import { linearBackoffTimeout } from '@conduitplatform/module-tools';
import { EventEmitter } from 'events';

export class ServiceMonitor {
  private static _instance: ServiceMonitor;
  private readonly _serviceRegistry = ServiceRegistry.getInstance();
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

  // OK
  private async healthCheckService(module: string, instanceId: string) {
    const instance = this._serviceRegistry.getModule(module)!.getInstance(instanceId)!;
    const status = await this.grpcSdk.isModuleUp(module, instance.address);
    this.updateInstanceHealth(module, instanceId, status);
    return status;
  }

  handleUnresponsiveInstance(moduleName: string, instanceId: string) {
    ConduitGrpcSdk.Logger.log(`SD/health: update ${moduleName}/${instanceId} unknown`);
    this.reviveService(moduleName, instanceId);
  }

  updateInstanceHealth(
    moduleName: string,
    instanceId: string,
    instanceStatus: HealthCheckStatus,
  ) {
    let module = this._serviceRegistry.getModule(moduleName);
    // if module doesn't exist in the registry, do nothing.
    if (!module) {
      return null;
    }
    module.updateInstanceHealth(instanceId, instanceStatus);
  }

  // OK
  updateModuleHealth(
    moduleName: string,
    instanceId: string,
    instanceStatus: HealthCheckStatus,
  ) {
    if (instanceStatus === HealthCheckStatus.SERVICE_UNKNOWN) {
      return this.handleUnresponsiveInstance(moduleName, instanceId);
    }

    let module = this._serviceRegistry.getModule(moduleName);
    // if module doesn't exist in the registry, do nothing.
    if (!module) {
      return null;
    }
    const instance = module.getInstance(instanceId);
    // if instance doesn't exist in the registry, do nothing.
    // instances should be registered before their first probe
    if (!instance) {
      return null;
    }
    const prevStatus = instance.serving;
    ConduitGrpcSdk.Logger.log(
      `SD/health: update instance ${moduleName}/${instanceId} to ${instanceStatus} from serving: ${prevStatus}`,
    );
    module.addOrUpdateInstance({ ...instance, status: instanceStatus });
  }

  /*
   * Attempt to reconnect to a recently removed module service.
   * Retries using linear backoff.
   */

  // OK
  private reviveService(name: string, instanceId: string) {
    const instance = this._serviceRegistry.getModule(name)!.getInstance(instanceId)!;

    const onTry = (stop: () => void) => {
      if (instance.serving) {
        stop();
        ConduitGrpcSdk.Logger.log(
          `SD/health/revive: found healthy ${name}/${instanceId}`,
        );
      } else {
        this.healthCheckService(name, instanceId)
          .then(() => {
            ConduitGrpcSdk.Logger.log(
              `SD/health/revive: check completed ${name}/${instanceId}`,
            );
          })
          .catch(() => {
            ConduitGrpcSdk.Logger.log(
              `SD/health/revive: check failed ${name}/${instanceId}`,
            );
          });
      }
    };
    const onFailure = () => {
      this._serviceRegistry.getModule(name)?.removeInstance(instanceId);
      ConduitGrpcSdk.Logger.log(
        `SD/health/revive: failed to recover ${name}/${instanceId}`,
      );
    };
    linearBackoffTimeout(
      onTry,
      this.serviceReconnectionInitMs,
      this.serviceReconnectionRetries,
      onFailure,
    );
  }

  // OK
  private async monitorModules() {
    for (const module of this._serviceRegistry.getRegisteredModules()) {
      const registeredModule = this._serviceRegistry.getModule(module)!;
      for (const instance of registeredModule.instances) {
        // skip instances with unknown status
        if (instance.status === HealthCheckStatus.UNKNOWN) continue;
        try {
          await this.healthCheckService(module, instance.instanceId);
        } catch (e) {
          if (this._serviceRegistry.getModule(module)) {
            registeredModule.updateInstanceHealth(
              instance.instanceId,
              HealthCheckStatus.UNKNOWN,
            );
            this.handleUnresponsiveInstance(module, instance.instanceId);
          }
        }
      }
    }
    this.moduleRegister.emit('serving-modules-update');
  }
}
