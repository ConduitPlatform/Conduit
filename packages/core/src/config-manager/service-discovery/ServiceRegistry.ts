import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { RegisteredModule } from '@conduitplatform/commons';

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

  updateModule(moduleName: string, module: RegisteredModule) {
    this.registeredModules.set(moduleName, module);
  }

  removeModule(moduleName: string) {
    this.registeredModules.delete(moduleName);
  }

  getModuleDetails(
    moduleName: string,
  ): { moduleName: string; url: string; serving: boolean } | undefined {
    const module = this.registeredModules.get(moduleName);
    if (!module) return undefined;
    return { moduleName: moduleName, url: module.address, serving: module.serving };
  }

  getModuleDetailsList(): { moduleName: string; url: string; serving: boolean }[] {
    const modules: { moduleName: string; url: string; serving: boolean }[] = [];
    this.registeredModules.forEach((value: RegisteredModule, key: string) => {
      modules.push({
        moduleName: key,
        url: value.address,
        serving: value.serving,
      });
    });
    return modules;
  }

  getRegisteredModules() {
    return Array.from(this.registeredModules.keys());
  }
}
