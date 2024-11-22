import {
  ModuleExistsRequest,
  ModuleExistsResponse,
  ModuleHealthRequest,
  ModuleListResponse,
  RegisterModuleRequest,
  RegisterModuleResponse,
} from '@conduitplatform/commons';
import {
  ConduitGrpcSdk,
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
  Indexable,
  ServerUnaryCall,
} from '@conduitplatform/grpc-sdk';
import { IModuleConfig } from '../../interfaces/IModuleConfig.js';
import { ServerWritableStream, status } from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { ServiceRegistry } from './ServiceRegistry.js';
import { ServiceMonitor } from './ServiceMonitor.js';
import { isEmpty } from 'lodash-es';
import { ServiceDiscoverMessage } from '../models/ServiceDiscover.message.js';
import { ModuleInstance, RegisteredModule } from '../models/RegisteredModule.js';

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

  getModule(name: string): RegisteredModule | undefined {
    return this._serviceRegistry.getModule(name);
  }

  beginMonitors() {
    this.highAvailability().then(() => this._serviceMonitor.beginMonitors());
  }

  async highAvailability() {
    const state = await this.grpcSdk.state?.getState();
    if (state && !isEmpty(state)) {
      const parsedState = JSON.parse(state) as { modules: IModuleConfig[] };
      if (parsedState.modules) {
        for (const module of parsedState.modules) {
          for (const instance of module.instances) {
            try {
              await this._recoverModule(module.name, instance);
            } catch (e) {
              ConduitGrpcSdk.Logger.error(
                `SD: failed to recover: ${module.name}@${instance.address}`,
              );
              ConduitGrpcSdk.Logger.error(`SD: recovery error: ${e}`);
            }
          }
        }
      }
    }
    this.grpcSdk.bus!.subscribe('service-discover', (message: string) => {
      const parsedMessage: ServiceDiscoverMessage = JSON.parse(message);
      if (parsedMessage.type === 'instance-health') {
        this._serviceMonitor.updateModuleHealth(
          parsedMessage.name,
          parsedMessage.instanceId,
          parsedMessage.status,
        );
      } else if (parsedMessage.type === 'serving-modules-update') {
        this._serviceRegistry.updateModule(parsedMessage.name, {
          address: parsedMessage.address,
          url: parsedMessage.url!,
          serving: true,
          instanceId: parsedMessage.instanceId,
          status: parsedMessage.status,
        });
      }
    });
  }

  /*
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
    const callingIp = (call as unknown as ServerUnaryCall<unknown, unknown>).getPeer();
    ConduitGrpcSdk.Logger.log(
      `SD: received: ${call.request.moduleName}/${call.request.instanceId}, source:${callingIp}, status${call.request.status}`,
    );
    this._serviceMonitor.updateModuleHealth(
      call.request.moduleName,
      call.request.instanceId,
      call.request.status as HealthCheckStatus,
    );
    this.publishInstanceHealth(
      'instance-health',
      call.request.moduleName,
      callingIp,
      call.request.instanceId,
      call.request.status,
    );
    callback(null, null);
  }

  moduleList(call: GrpcRequest<null>, callback: GrpcCallback<ModuleListResponse>) {
    const modules = this._serviceRegistry.getModuleDetailsList();
    //@ts-expect-error
    callback(null, { modules });
  }

  watchModules(call: ServerWritableStream<void, ModuleListResponse>) {
    this.moduleRegister.on('serving-modules-update', () => {
      const modules = this._serviceRegistry.getModuleDetailsList();
      //@ts-expect-error
      call.write({ modules });
    });
  }

  async _recoverModule(moduleName: string, instance: Omit<ModuleInstance, 'status'>) {
    let healthResponse;

    if (!this.grpcSdk.getModule(moduleName)) {
      healthResponse = await this.grpcSdk.isModuleUp(moduleName, instance.address);
      this.grpcSdk.createModuleClient(moduleName, instance.address);
    }

    const healthStatus = healthResponse.status as unknown as HealthCheckStatus;
    ConduitGrpcSdk.Logger.log(
      `SD: registering: ${moduleName}/${instance.instanceId}@${instance.address} ${healthStatus}`,
    );
    //@ts-expect-error
    this._serviceRegistry.updateModule(moduleName, instance);

    if (!this.grpcSdk.isAvailable(moduleName)) {
      this.grpcSdk.createModuleClient(moduleName, instance.address);
    }

    this._serviceMonitor.updateModuleHealth(
      moduleName,
      instance.instanceId,
      healthStatus,
    );
  }

  async _registerModule(
    moduleName: string,
    moduleUrl: string,
    instanceUrl: string,
    instanceId: string,
    healthStatus?: HealthCheckStatus,
  ) {
    if (healthStatus === undefined) {
      throw new Error('No module health status provided');
    }
    ConduitGrpcSdk.Logger.log(
      `SD: registering: ${moduleName} ${moduleUrl} ${healthStatus}`,
    );
    this._serviceRegistry.updateModule(moduleName, {
      address: instanceUrl,
      url: moduleUrl,
      instanceId: instanceId,
      serving: healthStatus === HealthCheckStatus.SERVING,
      status: healthStatus,
    });

    if (!this.grpcSdk.isAvailable(moduleName)) {
      this.grpcSdk.createModuleClient(
        moduleName,
        this._serviceRegistry.getModule(moduleName)!.servingAddress!,
      );
    }

    this._serviceMonitor.updateModuleHealth(moduleName, instanceId, healthStatus!);
  }

  async registerModule(
    call: GrpcRequest<RegisterModuleRequest>,
    callback: GrpcResponse<RegisterModuleResponse>,
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
    const callingIp = (call as unknown as ServerUnaryCall<unknown, unknown>).getPeer();
    await this._registerModule(
      call.request.moduleName,
      call.request.url,
      callingIp.split(':')[0] + ':' + call.request.url.split(':')[1],
      call.request.instanceId,
      call.request.healthStatus as HealthCheckStatus,
    );
    this.updateState(call.request.moduleName, call.request.url);
    this.publishModuleData(
      'serving-modules-update',
      call.request.moduleName,
      callingIp,
      call.request.url,
      call.request.instanceId,
      call.request.healthStatus,
    );
    callback(null, { result: true });
  }

  moduleExists(
    call: GrpcRequest<ModuleExistsRequest>,
    callback: GrpcResponse<ModuleExistsResponse>,
  ) {
    const module = this._serviceRegistry.getModule(call.request.moduleName);
    const hasAddress = module?.servingAddress;
    if (module && hasAddress) {
      callback(null, {
        url: module.servingAddress ?? module.allAddresses!,
        //@ts-expect-error
        instances: module.instances,
      });
    } else {
      callback({
        code: status.NOT_FOUND,
        message: "Module is missing or doesn't have a registered address",
      });
    }
  }

  private publishInstanceHealth(
    type: 'instance-health',
    name: string,
    address: string,
    instanceId: string,
    status: HealthCheckStatus,
  ) {
    const serviceDiscoverMessage: ServiceDiscoverMessage = {
      type,
      name,
      address,
      instanceId,
      status,
    };
    this.grpcSdk.bus!.publish('service-discover', JSON.stringify(serviceDiscoverMessage));
  }

  private publishModuleData(
    type: 'serving-modules-update',
    name: string,
    address: string,
    url: string,
    instanceId: string,
    status: HealthCheckStatus,
  ) {
    const serviceDiscoverMessage: ServiceDiscoverMessage = {
      type,
      name,
      address,
      url,
      instanceId,
      status,
    };
    this.grpcSdk.bus!.publish('service-discover', JSON.stringify(serviceDiscoverMessage));
  }

  // todo
  private updateState(name: string, url: string) {
    this.grpcSdk
      .state!.modifyState(async (existingState: Indexable) => {
        const state = existingState ?? {};
        if (!state.modules) state.modules = [];
        // const module = state.modules.find((module: IModuleConfig) => {
        //   return module.url === url;
        // });

        state.modules = [
          ...state.modules.filter((module: IModuleConfig) => module.name !== name),
          {
            ...module, //persist the module config schema
            name,
            url,
          },
        ];
        return state;
      })
      .then(() => {
        ConduitGrpcSdk.Logger.log(`SD: Updated state for ${name} ${url}`);
      })
      .catch(() => {
        ConduitGrpcSdk.Logger.error(`SD: Failed to update state ${name} ${url}`);
      });
  }
}
