import { ModuleListResponse, RegisteredModule } from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  GrpcCallback,
  GrpcRequest,
  GrpcResponse,
  HealthCheckStatus,
} from '@conduitplatform/grpc-sdk';
import { ServerWritableStream, status } from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { IModuleConfig } from '../../interfaces/IModuleConfig';

export class ServiceDiscovery {
  readonly registeredModules: Map<string, RegisteredModule> = new Map<
    string,
    RegisteredModule
  >();
  private readonly moduleHealth: {
    [module: string]: {
      [field: string]: { timestamp: number; status: HealthCheckStatus };
    };
  } = {};
  private readonly moduleRegister: EventEmitter;
  private servingStatusUpdate: boolean = false;
  private readonly monitorInterval: number; // milliseconds

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.moduleRegister = new EventEmitter();
    this.moduleRegister.setMaxListeners(150);
    const specifiedInterval = parseInt(process.env.SERVICE_MONITOR_INTERVAL_MS ?? '');
    this.monitorInterval = !isNaN(specifiedInterval) ? specifiedInterval : 30000;
    ConduitGrpcSdk.Logger.log(
      `Service discovery monitoring interval set to ${this.monitorInterval}ms`,
    );
  }

  beginMonitors() {
    const disableModuleRemoval = process.env.DEBUG__DISABLE_SERVICE_REMOVAL === 'true';
    if (!disableModuleRemoval) {
      const self = this;
      setInterval(() => {
        self.monitorModuleHealth();
      }, this.monitorInterval);
    }
  }

  publishModuleData(type: string, name: string, instance: string, url?: string) {
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
      call.getPeer(),
      call.request.status as HealthCheckStatus,
    );
    this.publishModuleData('module-health', call.request.moduleName, call.getPeer());
    callback(null, null);
  }

  monitorModuleHealth() {
    let removedCount = 0;
    Object.keys(this.moduleHealth).forEach(moduleName => {
      const module = this.moduleHealth[moduleName];
      const offlineInstances = Object.keys(module).filter(
        url => module[url].timestamp + 5000 < Date.now(),
      );
      const nonServingInstances = Object.keys(module).filter(
        url => module[url].status !== HealthCheckStatus.SERVING,
      );
      if (offlineInstances?.length > 0 || nonServingInstances.length > 0) {
        removedCount += offlineInstances.length + nonServingInstances.length;
        offlineInstances.forEach(url => {
          delete module[url];
        });
      }
    });
    if (removedCount > 0) {
      const unhealthyModules = Object.keys(this.moduleHealth).filter(
        moduleName => Object.keys(this.moduleHealth[moduleName]).length === 0,
      );
      if (unhealthyModules?.length > 0) {
        unhealthyModules.forEach(moduleName => {
          delete this.moduleHealth[moduleName];
          this.registeredModules.delete(moduleName);
        });
        this.servingStatusUpdate = true;
      }
    }
    if (this.servingStatusUpdate) {
      this.moduleRegister.emit('serving-modules-update');
      this.servingStatusUpdate = false;
    }
  }

  updateModuleHealth(
    moduleName: string,
    moduleUrl: string,
    moduleAddress: string,
    moduleStatus: HealthCheckStatus,
    broadcast = true,
  ) {
    if (!this.moduleHealth[moduleName]) {
      this.moduleHealth[moduleName] = {};
    }
    let module = this.registeredModules.get(moduleName);
    if (!module) {
      module = {
        address: moduleUrl,
        serving: moduleStatus === HealthCheckStatus.SERVING,
      };
      this.registeredModules.set(moduleName, module);
      this.moduleRegister.emit('serving-modules-update');
    }
    const prevStatus = module.serving;
    module.serving = moduleStatus === HealthCheckStatus.SERVING;
    if (!this.servingStatusUpdate && prevStatus !== module.serving && broadcast) {
      this.servingStatusUpdate = true;
    }
    this.registeredModules.set(moduleName, module);
    this.moduleHealth[moduleName][moduleAddress] = {
      timestamp: Date.now(),
      status: moduleStatus,
    };
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
      const modules: any[] = [];
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

  getModuleUrlByName(name: string): string | undefined {
    return this.registeredModules.get(name)?.address;
  }

  async _registerModule(
    moduleName: string,
    moduleUrl: string,
    instancePeer: string,
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
      instancePeer,
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
      call.getPeer(),
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

  updateState(name: string, url: string, instance: string) {
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
