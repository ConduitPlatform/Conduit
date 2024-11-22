import { getAddressType } from '../utils/index.js';
import { ConduitGrpcSdk, HealthCheckStatus } from '@conduitplatform/grpc-sdk';

export type ModuleInstance = {
  instanceId: string;
  address: string;
  url: string;
  status: HealthCheckStatus;
  serving?: boolean;
  addressType?: 'ipv4' | 'ipv6' | 'dns';
};

export class RegisteredModule {
  private readonly _name: string;
  private _instances: ModuleInstance[] = [];

  constructor(name: string, grpcSdk: ConduitGrpcSdk);
  constructor(name: string, grpcSdk: ConduitGrpcSdk, instances: ModuleInstance[]);
  constructor(
    name: string,
    private readonly grpcSdk: ConduitGrpcSdk,
    instances?: ModuleInstance[],
  ) {
    this._name = name;
    if (instances) {
      for (const instance of instances) {
        this.addOrUpdateInstance(instance);
      }
    }
  }

  get name() {
    return this._name;
  }

  public get isServing() {
    return this._instances.some(i => i.serving);
  }

  public get servingAddress() {
    if (!this._instances.some(i => i.serving)) {
      return undefined;
    }
    const servingInstances = this._instances.filter(i => i.serving);
    let addressType = getAddressType(servingInstances[0].url);
    if (addressType === 'dns') {
      return `dns:///${servingInstances[0].url}`;
    } else {
      return `${addressType}:${servingInstances.map(i => i.url).join(',')}`;
    }
  }

  public get allAddresses() {
    if (this._instances.length === 0) {
      return undefined;
    }
    let addressType = getAddressType(this._instances[0].url);
    if (addressType === 'dns') {
      return `dns:///${this._instances[0].url}`;
    } else {
      return `${addressType}:${this._instances.map(i => i.url).join(',')}`;
    }
  }

  public updateInstanceHealth(instanceId: string, status: HealthCheckStatus) {
    const instance = this._instances.find(i => i.instanceId === instanceId);
    if (instance) {
      instance.status = status;
      instance.serving = instance.status === HealthCheckStatus.SERVING;
      this.updateServingList();
    }
  }

  public addOrUpdateInstance(instance: ModuleInstance) {
    const index = this._instances.findIndex(i => i.instanceId === instance.instanceId);
    if (!instance.addressType) {
      instance.addressType = getAddressType(instance.url);
    }
    this._instances.findIndex(i => i.address === instance.instanceId);
    if (index === -1) {
      this._instances.push(instance);
    } else {
      this._instances[index] = { ...this._instances[index], ...instance };
    }
  }

  private updateServingList() {
    // count the number of instances that are serving per address type
    const servingCount: Record<string, number> = {};
    for (const instance of this._instances) {
      if (instance.serving) {
        servingCount[instance.addressType!] =
          (servingCount[instance.addressType!] || 0) + 1;
      }
    }
    if (!this._instances.some(i => i.status === HealthCheckStatus.SERVING)) {
      ConduitGrpcSdk.Logger.warn(
        `Module ${this._name} has no serving instances. Communication with this module will fail.`,
      );
    } else {
      ConduitGrpcSdk.Logger.log(
        `Module ${this._name} has ${
          this._instances.filter(i => i.serving).length
        } serving instances.`,
      );
      this.grpcSdk.updateModuleHealth(this._name, true);
    }
  }

  public removeInstance(instanceId: string) {
    this._instances = this._instances.filter(i => i.instanceId !== instanceId);
  }

  public getInstance(instanceId: string) {
    return this._instances.find(i => i.instanceId === instanceId);
  }

  public get instances() {
    return this._instances;
  }
}
