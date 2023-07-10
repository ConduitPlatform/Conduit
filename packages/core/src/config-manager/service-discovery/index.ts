import { ModuleListResponse, RegisteredModule } from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { linearBackoffTimeout } from '@conduitplatform/module-tools';
import { IModuleConfig } from '../../interfaces/IModuleConfig';
import { ServerWritableStream, status } from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { clearTimeout } from 'timers';

/*
 * - Multi-instance services are not handled individually (LoadBalancer)
 * - Online Services are recovered on startup
 * - Unresponsive services are instantly removed from the list of exposed services
 * - Reconnection to recently removed services is attempted using linear backoff
 * - Services that do not provide a gRPC health check service are assumed to be healthy
 */
export class ServiceDiscovery {
  readonly registeredModules: Map<string, RegisteredModule> = new Map<
    string,
    RegisteredModule
  >();
  private readonly moduleHealth: {
    [module: string]: { address: string; timestamp: number; status: HealthCheckStatus };
  } = {};
  private readonly moduleRegister: EventEmitter;
  private servingStatusUpdate: boolean = false;
  private monitorIntervalMs = 30000;
  private serviceReconnRetries = 5;
  private serviceReconnInitMs = 250;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.moduleRegister = new EventEmitter();
    this.moduleRegister.setMaxListeners(150);
  }

  getModuleUrlByName(name: string): string | undefined {
    return this.registeredModules.get(name)?.address;
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
    }
  }

  /*
   * Used by modules to notify Core regarding changes in their health state.
   * Called on module health change via grpc-sdk.
   */
  moduleHealthProbe(call: any, callback: GrpcResponse<null>) {
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
      call.request.url,
      call.request.status as HealthCheckStatus,
    );
    this.publishModuleData('module-health', call.request.moduleName, call.getPeer());
    callback(null, null);
  }

  moduleList(call: GrpcRequest<null>, callback: GrpcCallback<ModuleListResponse>) {
    const modules: {
      moduleName: string;
      url: string;
      serving: boolean;
    }[] = [];
    this.registeredModules.forEach((value: RegisteredModule, key: string) => {
      modules.push({
        moduleName: key,
        url: value.address,
        serving: value.serving,
      });
    });
    callback(null, { modules });
  }

  watchModules(call: ServerWritableStream<void, ModuleListResponse>) {
    const self = this;
    this.moduleRegister.on('serving-modules-update', () => {
      const modules: UntypedArray = [];
      self.registeredModules.forEach((value: RegisteredModule, key: string) => {
        modules.push({
          moduleName: key,
          url: value.address,
          serving: value.serving,
        });
      });
      call.write({ modules });
    });
    // todo this should close gracefully I guess.
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
    moduleName: string,
    moduleUrl: string,
    healthStatus?: HealthCheckStatus,
    fromGrpc = false,
  ) {
    if (fromGrpc && healthStatus === undefined) {
      throw new Error('No module health status provided');
    }
    if (!fromGrpc) {
      let healthResponse;
      try {
        if (!this.grpcSdk.getModule(moduleName)) {
          healthResponse = await this.grpcSdk.isModuleUp(moduleName, moduleUrl);
          this.grpcSdk.createModuleClient(moduleName, moduleUrl);
        }
      } catch (e) {
        throw new Error('Failed to register unresponsive module');
      }
      healthStatus = healthResponse.status as unknown as HealthCheckStatus;
    }
    this.registeredModules.set(moduleName, {
      address: moduleUrl,
      serving: healthStatus === HealthCheckStatus.SERVING,
    });

    if (!this.grpcSdk.isAvailable(moduleName)) {
      this.grpcSdk.createModuleClient(moduleName, moduleUrl);
    }

    this.updateModuleHealth(
      moduleName,
      moduleUrl,
      fromGrpc ? healthStatus! : HealthCheckStatus.SERVING,
      false,
    );
    this.moduleRegister.emit('serving-modules-update');
  }

  async registerModule(call: any, callback: GrpcResponse<{ result: boolean }>) {
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
    await this._registerModule(
      call.request.moduleName,
      call.request.url,
      call.request.healthStatus as HealthCheckStatus,
      true,
    );
    this.updateState(call.request.moduleName, call.request.url, call.getPeer());
    this.publishModuleData(
      'serving-modules-update',
      call.request.moduleName,
      call.getPeer(),
      call.request.url,
    );
    callback(null, { result: true });
  }

  moduleExists(
    call: GrpcRequest<{ moduleName: string }>,
    callback: GrpcResponse<{ url: string }>,
  ) {
    if (this.registeredModules.has(call.request.moduleName)) {
      const address = this.registeredModules.get(call.request.moduleName)!.address;
      callback(null, { url: address });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module is missing',
      });
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
        .then(res => res.status as unknown as HealthCheckStatus)
        .catch(() => {
          return HealthCheckStatus.SERVICE_UNKNOWN;
        });
    }
    const isRegistered = Object.keys(this.moduleHealth).includes(module);
    if (!isRegistered && status === HealthCheckStatus.SERVICE_UNKNOWN) return;
    this.updateModuleHealth(module, address, status);
  }

  private async monitorModules() {
    for (const module of Object.keys(this.moduleHealth)) {
      const registeredModule = this.registeredModules.get(module)!;
      await this.healthCheckService(module, registeredModule.address);
    }
    if (this.servingStatusUpdate) {
      this.moduleRegister.emit('serving-modules-update');
      this.servingStatusUpdate = false;
    }
  }

  /*
   * Attempt to reconnect to a recently removed module service.
   * Retries using linear backoff.
   */
  private reviveService(name: string, address: string) {
    const onTry = (timeout: NodeJS.Timeout) => {
      if (Object.keys(this.moduleHealth).includes(name)) {
        clearTimeout(timeout);
      } else {
        this.healthCheckService(name, address).then();
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
    moduleUrl: string,
    moduleStatus: HealthCheckStatus,
    broadcast = true,
  ) {
    if (moduleStatus === HealthCheckStatus.SERVICE_UNKNOWN) {
      this.grpcSdk.updateModuleHealth(moduleName, false);
      // Deregister Unresponsive Module
      delete this.moduleHealth[moduleName];
      this.registeredModules.delete(moduleName);
      this.servingStatusUpdate = true;
      this.reviveService(moduleName, moduleUrl);
      return;
    }
    let module = this.registeredModules.get(moduleName);
    if (!module) {
      module = {
        address: moduleUrl,
        serving: moduleStatus === HealthCheckStatus.SERVING,
      };
      this.registeredModules.set(moduleName, module);
      this.servingStatusUpdate = true;
    } else {
      const prevStatus = module.serving;
      module.serving = moduleStatus === HealthCheckStatus.SERVING;
      if (!this.servingStatusUpdate && prevStatus !== module.serving && broadcast) {
        this.servingStatusUpdate = true;
      }
    }
    this.grpcSdk.updateModuleHealth(
      moduleName,
      moduleStatus === HealthCheckStatus.SERVING,
    );
    this.registeredModules.set(moduleName, module);
    this.moduleHealth[moduleName] = {
      address: moduleUrl,
      timestamp: Date.now(),
      status: moduleStatus,
    };
  }

  private updateState(name: string, url: string, instance: string) {
    this.grpcSdk
      .state!.getKey('config')
      .then(r => {
        const state = !r || r.length === 0 ? {} : JSON.parse(r);
        if (!state.modules) state.modules = [];
        const module = state.modules.find((module: IModuleConfig) => {
          return module.url === url;
        });

        state.modules = [
          ...state.modules.filter((module: IModuleConfig) => module.name !== name),
          {
            ...module, //persist the module config schema
            name,
            instance,
            url,
          },
        ];

        return this.grpcSdk.state!.setKey('config', JSON.stringify(state));
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to recover state');
      });
  }
}
