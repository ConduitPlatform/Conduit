import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleInstance, RegisteredModule } from '../models/RegisteredModule.js';

export class ServiceRegistry {
  private static _instance: ServiceRegistry;
  private readonly registeredModules: Map<string, RegisteredModule> = new Map<
    string,
    RegisteredModule
  >();

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (!grpcSdk && !this._instance) {
      throw new Error('ServiceRegistry not initialized');
    }
    if (!this._instance) {
      this._instance = new ServiceRegistry(grpcSdk!);
    }
    return this._instance;
  }

  getModule(moduleName: string) {
    return this.registeredModules.get(moduleName);
  }

  updateModule(moduleName: string, module: ModuleInstance) {
    const existingModule = this.registeredModules.get(moduleName);
    if (existingModule) {
      existingModule.addOrUpdateInstance(module);
    } else {
      const newModule = new RegisteredModule(moduleName, this.grpcSdk, [module]);
      this.registeredModules.set(moduleName, newModule);
    }
  }

  removeModule(moduleName: string) {
    this.registeredModules.delete(moduleName);
  }

  getModuleDetailsList(): {
    moduleName: string;
    url: string;
    serving: boolean;
    instances: ModuleInstance[];
  }[] {
    const modules: {
      moduleName: string;
      url: string;
      serving: boolean;
      instances: ModuleInstance[];
    }[] = [];
    this.registeredModules.forEach((value: RegisteredModule, key: string) => {
      modules.push({
        moduleName: key,
        url: value.servingAddress ?? value.allAddresses!,
        serving: value.isServing,
        instances: value.instances,
      });
    });
    return modules;
  }

  getRegisteredModules() {
    return Array.from(this.registeredModules.keys());
  }
}
