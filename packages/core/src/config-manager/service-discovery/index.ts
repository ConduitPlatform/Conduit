import {
  DeploymentState,
  DeploymentState_ModuleStateInfo as ModuleStateInfo,
  Empty,
  ModuleHealthRequest,
  RegisterModuleRequest,
  RegisterModuleRequest_ConduitManifest as ConduitManifest,
} from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  linearBackoffTimeout,
  ManifestManager,
  ModuleActivationStatus,
} from '@conduitplatform/grpc-sdk';
import {
  ModuleClient,
  ModuleRegistrationState,
  ServiceDiscoveryState,
} from '../../interfaces';
import { ServerWritableStream, status } from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { clearTimeout } from 'timers';

/**
 * - Multi-instance services are not handled individually (LoadBalancer)
 * - Services are distinguished between Available and Pending based on whether their dependencies are met
 * - Online Services are recovered on startup
 * - Unresponsive services are instantly removed from the list of exposed services
 * - Reconnection to recently removed services is attempted using linear backoff
 * - Services that do not provide a gRPC health check service are assumed to be healthy
 */
export class ServiceDiscovery {
  readonly registeredModules: Map<string, ModuleStateInfo>;
  private readonly moduleManifests: Map<string, ConduitManifest> = new Map();
  private readonly moduleHealth: {
    [module: string]: { address: string; timestamp: number; status: HealthCheckStatus };
  } = {};
  private deploymentStateModified: boolean = false;
  private readonly moduleRegister: EventEmitter;
  private monitorIntervalMs = 30000;
  private serviceReconnRetries = 5;
  private serviceReconnInitMs = 250;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly conduitHealthCheckGetter: (service: '') => HealthCheckStatus,
  ) {
    this.moduleRegister = new EventEmitter();
    this.moduleRegister.setMaxListeners(150);
    this.registeredModules = new Map([
      [
        'conduit',
        {
          moduleName: 'conduit',
          moduleVersion: ManifestManager.getInstance().moduleVersion,
          moduleUrl: 'unknown', // TODO
          pending: false,
          serving: this.conduitHealthCheckGetter('') === HealthCheckStatus.SERVING,
        },
      ],
    ]);
  }

  getModuleUrlByName(moduleName: string): string | undefined {
    return this.registeredModules.get(moduleName)?.moduleUrl;
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
      if (!isNaN(specifiedRetryInit)) this.serviceReconnInitMs = specifiedRetryInit;
      if (!isNaN(specifiedInterval)) this.monitorIntervalMs = specifiedInterval;
      if (!isNaN(specifiedRetries)) this.serviceReconnRetries = specifiedRetries;
      ConduitGrpcSdk.Logger.log(
        `Service discovery monitoring interval set to ${this.monitorIntervalMs}ms`,
      );
      setInterval(() => {
        this.monitorModules().then();
      }, this.monitorIntervalMs);
      setInterval(() => {
        if (!this.deploymentStateModified) return;
        [...this.registeredModules.values()]
          .filter(m => m.moduleName !== 'conduit' && m.pending)
          .forEach(m => this.attemptModuleActivation(m));
      }, 500);
    }
  }

  private publishModuleData(type: string, name: string, instance: string, url?: string) {
    this.grpcSdk.bus!.publish(
      'config',
      JSON.stringify({
        type,
        name,
        url,
        instance,
      }),
    );
  }

  /**
   * Health checks target module service, updating its health state.
   * Any services that do not provide a gRPC health check service are assumed to be healthy.
   * Used by healthCheckRegisteredModules(), reviveService()
   */
  private async healthCheckService(module: string, version: string, address: string) {
    const healthClient = this.grpcSdk.getHealthClient(module);
    let status = HealthCheckStatus.SERVING;
    if (healthClient) {
      status = await healthClient
        .check({})
        .then(res => res.status as unknown as HealthCheckStatus)
        .catch(() => {
          return HealthCheckStatus.SERVICE_UNKNOWN;
        });
    }
    const isRegistered = Object.keys(this.moduleHealth).includes(module);
    if (!isRegistered && status === HealthCheckStatus.SERVICE_UNKNOWN) return;
    this.updateModuleHealth(module, version, address, status);
  }

  private async monitorModules() {
    this.registeredModules.forEach(m =>
      this.healthCheckService(m.moduleName, m.moduleVersion, m.moduleUrl),
    );
    if (this.deploymentStateModified) {
      this.moduleRegister.emit('serving-modules-update');
      this.deploymentStateModified = false;
    }
  }

  private async attemptModuleActivation(
    module: ModuleStateInfo,
    healthStatus?: HealthCheckStatus,
  ): Promise<ModuleRegistrationState> {
    const readyCheckRes = ManifestManager.getInstance().readyCheck(
      this.registeredModules,
      this.moduleManifests.get(module.moduleName)!,
    );
    if (readyCheckRes.issues.length > 0) {
      return Promise.resolve(ModuleRegistrationState.PENDING);
    }
    if (!healthStatus) {
      const healthClient = this.grpcSdk.getHealthClient(module.moduleName)!;
      healthStatus = await healthClient
        .check({})
        .then(res => res.status as unknown as HealthCheckStatus)
        .catch(() => {
          return HealthCheckStatus.SERVICE_UNKNOWN;
        });
      if (healthStatus === HealthCheckStatus.SERVICE_UNKNOWN) {
        return Promise.resolve(ModuleRegistrationState.PENDING);
      }
    }
    await this.enableModule(
      module.moduleName,
      module.moduleVersion,
      module.moduleUrl,
      healthStatus,
    );
    return Promise.resolve(ModuleRegistrationState.AVAILABLE);
  }

  /**
   * Used by modules to notify Core regarding changes in their health state.
   * Called on module health change via grpc-sdk.
   */
  moduleHealthProbe(
    call: GrpcRequest<ModuleHealthRequest>,
    callback: GrpcResponse<null>,
  ) {
    if (
      call.request.status < HealthCheckStatus.UNKNOWN ||
      call.request.status > HealthCheckStatus.NOT_SERVING
    ) {
      callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid module health status code value',
      });
      return;
    }
    this.updateModuleHealth(
      call.request.moduleName,
      call.request.moduleVersion,
      call.request.moduleUrl,
      call.request.status as HealthCheckStatus,
    );
    this.publishModuleData(
      'module-health',
      call.request.moduleName,
      (call as any).getPeer(),
    );
    callback(null, null);
  }

  /**
   * Attempt to reconnect to a recently removed module service.
   * Retries using linear backoff.
   */
  private reviveService(name: string, version: string, address: string) {
    const onTry = (timeout: NodeJS.Timeout) => {
      if (Object.keys(this.moduleHealth).includes(name)) {
        clearTimeout(timeout);
      } else {
        this.healthCheckService(name, version, address).then();
      }
    };
    const onFailure = () => {
      this.grpcSdk.getModule(name)?.closeConnection();
    };
    linearBackoffTimeout(
      onTry,
      this.serviceReconnInitMs,
      this.serviceReconnRetries,
      onFailure,
    );
  }

  private updateModuleHealth(
    moduleName: string,
    moduleVersion: string,
    moduleUrl: string,
    moduleStatus: HealthCheckStatus,
    broadcast = true,
  ) {
    if (moduleStatus === HealthCheckStatus.SERVICE_UNKNOWN) {
      delete this.moduleHealth[moduleName];
      if (!this.registeredModules.delete(moduleName)) return;
      this.deploymentStateModified = true;
      this.reviveService(moduleName, moduleVersion, moduleUrl);
      return;
    }
    let module = this.registeredModules.get(moduleName);
    if (!module) {
      module = {
        moduleName,
        moduleVersion,
        moduleUrl,
        pending: true,
        serving: moduleStatus === HealthCheckStatus.SERVING,
      };
      this.registeredModules.set(moduleName, module);
      this.deploymentStateModified = true;
    } else {
      const prevPendingStatus = module.pending;
      const prevServingStatus = module.serving;
      module.serving = moduleStatus === HealthCheckStatus.SERVING;
      const stateModified =
        prevPendingStatus !== module.pending || prevServingStatus !== module.serving;
      if (stateModified && broadcast) {
        this.deploymentStateModified = true;
      }
    }
    this.registeredModules.set(moduleName, module);
    this.moduleHealth[moduleName] = {
      address: moduleUrl,
      timestamp: Date.now(),
      status: moduleStatus,
    };
  }

  getDeploymentState(call: GrpcRequest<null>, callback: GrpcResponse<DeploymentState>) {
    callback(null, { modules: Array.from(this.registeredModules.values()) });
  }

  watchDeploymentState(call: ServerWritableStream<void, DeploymentState>) {
    this.moduleRegister.on('serving-modules-update', () =>
      call.write({ modules: Array.from(this.registeredModules.values()) }),
    );
  }

  getModuleUrlByNameGrpc(
    call: GrpcRequest<{ name: string }>,
    callback: GrpcResponse<{ moduleUrl: string }>,
  ) {
    const name = call.request.name;
    const result = this.getModuleUrlByName(name);
    if (result) {
      callback(null, { moduleUrl: result });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module not found',
      });
    }
  }

  async _registerModule(
    moduleManifest: ConduitManifest,
    moduleUrl: string,
    healthStatus?: HealthCheckStatus,
  ) {
    const { moduleName, moduleVersion } = moduleManifest;
    this.grpcSdk.createModuleClient(moduleName, moduleUrl);
    if (!healthStatus) {
      const healthResponse = await this.grpcSdk.checkServiceHealth(moduleUrl);
      if (healthResponse === HealthCheckStatus.SERVICE_UNKNOWN) {
        throw new Error('Failed to register unresponsive module');
      }
      healthStatus = healthResponse as unknown as HealthCheckStatus;
    }
    this.moduleManifests.set(moduleManifest.moduleName, moduleManifest);
    const moduleInfo: ModuleStateInfo = {
      moduleName,
      moduleVersion,
      moduleUrl,
      pending: true,
      serving: healthStatus === HealthCheckStatus.SERVING,
    };
    this.registeredModules.set(moduleName, moduleInfo);
    this.attemptModuleActivation(moduleInfo, healthStatus).then();
  }

  private async enableModule(
    name: string,
    version: string,
    url: string,
    healthStatus: HealthCheckStatus,
  ) {
    const module = this.registeredModules.get(name);
    if (module?.pending) {
      module.pending = false;
    }
    const moduleClient = this.grpcSdk.getServiceClient<any>(
      name,
    )! as unknown as ModuleClient;
    const activationStatus = await moduleClient
      .activateModule()
      .then(res => Promise.resolve(res.status))
      .catch(() => {
        return Promise.resolve(ModuleActivationStatus.UNRECOGNIZED);
      });
    if (activationStatus !== ModuleActivationStatus.ACTIVATED) return;
    this.updateModuleHealth(name, version, url, healthStatus, false);
    this.moduleRegister.emit('serving-modules-update');
  }

  async registerModuleGrpc(
    call: GrpcRequest<RegisterModuleRequest>,
    callback: GrpcResponse<Empty>,
  ) {
    if (
      call.request.healthStatus < HealthCheckStatus.UNKNOWN ||
      call.request.healthStatus > HealthCheckStatus.NOT_SERVING
    ) {
      callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid module health status code value',
      });
      return;
    }
    const moduleManifest = call.request.manifest!; // inaccurate protoc type generation (optional)
    const { moduleName } = moduleManifest;
    const instance = (call as any).getPeer();
    await this._registerModule(
      moduleManifest,
      call.request.url,
      call.request.healthStatus as HealthCheckStatus,
    );
    this.updateRedisState(moduleManifest, call.request.url, instance);
    this.publishModuleData(
      'serving-modules-update',
      moduleName,
      instance,
      call.request.url,
    );
    callback(null, {});
  }

  private updateRedisState(manifest: ConduitManifest, url: string, instance: string) {
    this.grpcSdk
      .state!.getKey('serviceDiscovery')
      .then(r => {
        const state: ServiceDiscoveryState = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.modules) state.modules = [];
        const module = state.modules.find(module => {
          return module.url === url;
        });

        state.modules = [
          ...state.modules.filter(m => m.manifest.moduleName !== manifest.moduleName),
          {
            ...module, // persist the module config schema
            manifest,
            instance,
            url,
          },
        ];
        return this.grpcSdk.state!.setKey('serviceDiscovery', JSON.stringify(state));
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated Redis state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to recover Redis state');
      });
  }
}
