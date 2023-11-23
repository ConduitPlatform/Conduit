import { ModuleListResponse } from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { IModuleConfig } from '../../interfaces/IModuleConfig';
import { ServerWritableStream, status } from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { ServiceRegistry } from './ServiceRegistry';
import { ServiceMonitor } from './ServiceMonitor'; /*

/*
 * - Multi-instance services are not handled individually (LoadBalancer)
 * - Online Services are recovered on startup
 * - Unresponsive services are instantly removed from the list of exposed services
 * - Reconnection to recently removed services is attempted using linear backoff
 * - Services that do not provide a gRPC health check service are considered as healthy
 */
export class ServiceDiscovery {
  private readonly moduleRegister: EventEmitter;

  private readonly _serviceRegistry: ServiceRegistry;
  private readonly _serviceMonitor: ServiceMonitor;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.moduleRegister = new EventEmitter();
    this.moduleRegister.setMaxListeners(150);
    this._serviceRegistry = ServiceRegistry.getInstance(grpcSdk);
    this._serviceMonitor = ServiceMonitor.getInstance(grpcSdk, this.moduleRegister);
  }

  getModuleUrlByName(name: string): string | undefined {
    return this._serviceRegistry.getModule(name)?.address;
  }

  beginMonitors() {
    this.highAvailability();
    this._serviceMonitor.beginMonitors();
  }

  async highAvailability() {
    const loadedState = await this.grpcSdk.state!.getKey('config');
    try {
      if (!loadedState || loadedState.length === 0) return;
      const state = JSON.parse(loadedState);
      const success: IModuleConfig[] = [];
      if (state.modules) {
        for (const module of state.modules) {
          try {
            await this._recoverModule(module.name, module.url);
            success.push({
              name: module.name,
              url: module.url,
              ...(module.configSchema && { configSchema: module.configSchema }),
            });
          } catch {}
        }
        if (state.modules.length > success.length) {
          state.modules = success;
          this.setState(state);
        }
      } else {
        return Promise.resolve();
      }
    } catch {
      ConduitGrpcSdk.Logger.error('Failed to recover state');
    }
    this.grpcSdk.bus!.subscribe('config', (message: string) => {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'module-health') {
        this._serviceMonitor.updateModuleHealth(
          parsedMessage.name,
          parsedMessage.url,
          parsedMessage.status,
        );
      } else if (parsedMessage.type === 'serving-modules-update') {
        this._serviceRegistry.updateModule(parsedMessage.name, {
          address: parsedMessage.url,
          serving: true,
        });
      }
    });
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
    ConduitGrpcSdk.Logger.log(
      `SD: received: ${call.request.moduleName} ${call.request.url} ${call.request.status}`,
    );
    this._serviceMonitor.updateModuleHealth(
      call.request.moduleName,
      call.request.url,
      call.request.status as HealthCheckStatus,
    );
    this.publishModuleData(
      'module-health',
      call.request.moduleName,
      call.request.url,
      call.request.status,
    );
    callback(null, null);
  }

  moduleList(call: GrpcRequest<null>, callback: GrpcCallback<ModuleListResponse>) {
    const modules = this._serviceRegistry.getModuleDetailsList();
    callback(null, { modules });
  }

  watchModules(call: ServerWritableStream<void, ModuleListResponse>) {
    this.moduleRegister.on('serving-modules-update', () => {
      const modules = this._serviceRegistry.getModuleDetailsList();
      call.write({ modules });
    });
    // todo this should close gracefully I guess.
  }

  async _recoverModule(moduleName: string, moduleUrl: string) {
    let healthResponse;
    try {
      if (!this.grpcSdk.getModule(moduleName)) {
        healthResponse = await this.grpcSdk.isModuleUp(moduleName, moduleUrl);
        this.grpcSdk.createModuleClient(moduleName, moduleUrl);
      }
    } catch (e) {
      throw new Error('Failed to register unresponsive module');
    }
    const healthStatus = healthResponse.status as unknown as HealthCheckStatus;
    ConduitGrpcSdk.Logger.log(
      `SD: registering: ${moduleName} ${moduleUrl} ${healthStatus}`,
    );
    this._serviceRegistry.updateModule(moduleName, {
      address: moduleUrl,
      serving: healthStatus === HealthCheckStatus.SERVING,
    });

    if (!this.grpcSdk.isAvailable(moduleName)) {
      this.grpcSdk.createModuleClient(moduleName, moduleUrl);
    }

    this._serviceMonitor.updateModuleHealth(moduleName, moduleUrl, healthStatus, true);
  }

  async _registerModule(
    moduleName: string,
    moduleUrl: string,
    healthStatus?: HealthCheckStatus,
  ) {
    if (healthStatus === undefined) {
      throw new Error('No module health status provided');
    }
    ConduitGrpcSdk.Logger.log(
      `SD: registering: ${moduleName} ${moduleUrl} ${healthStatus}`,
    );
    this._serviceRegistry.updateModule(moduleName, {
      address: moduleUrl,
      serving: healthStatus === HealthCheckStatus.SERVING,
    });

    if (!this.grpcSdk.isAvailable(moduleName)) {
      this.grpcSdk.createModuleClient(moduleName, moduleUrl);
    }

    this._serviceMonitor.updateModuleHealth(moduleName, moduleUrl, healthStatus!, true);
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
    );
    this.updateState(call.request.moduleName, call.request.url);
    this.publishModuleData(
      'serving-modules-update',
      call.request.moduleName,
      call.request.url,
      call.request.healthStatus,
    );
    callback(null, { result: true });
  }

  moduleExists(
    call: GrpcRequest<{ moduleName: string }>,
    callback: GrpcResponse<{ url: string }>,
  ) {
    const module = this._serviceRegistry.getModule(call.request.moduleName);
    if (module) {
      callback(null, { url: module.address });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: 'Module is missing',
      });
    }
  }

  //todo not subscribed by anyone
  private publishModuleData(
    type: string,
    name: string,
    url?: string,
    status?: HealthCheckStatus,
  ) {
    this.grpcSdk.bus!.publish(
      'config',
      JSON.stringify({
        type,
        name,
        url,
        status,
      }),
    );
  }

  private updateState(name: string, url: string) {
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

  setState(state: Indexable) {
    this.grpcSdk
      .state!.setKey('config', JSON.stringify(state))
      .then(() => {
        ConduitGrpcSdk.Logger.log('Updated state');
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error('Failed to recover state');
      });
  }
}
