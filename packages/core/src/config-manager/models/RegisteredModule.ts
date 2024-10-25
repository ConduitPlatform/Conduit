import { formatAddress, getAddressType } from '../utils/index.js';
import dns from 'node:dns';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

export type ModuleInstance = {
  instanceId: string;
  address: string;
  serving: boolean;
  addressType?: 'ipv4' | 'ipv6' | 'dns';
};

export class RegisteredModule {
  private readonly _name: string;
  private _instances: ModuleInstance[] = [];
  // Should always be array of IP addresses of the same type,
  // but may contain either ipv4 or ipv6 addresses.
  private _resolvedAddresses: string[] = [];
  // Should always be array of IP addresses of the same type
  private _servingAddresses: string[] = [];

  constructor(name: string);
  constructor(name: string, instances: ModuleInstance[]);
  constructor(name: string, instances?: ModuleInstance[]) {
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
    return this._servingAddresses.length > 0;
  }

  public get servingAddress() {
    if (this._servingAddresses.length === 0) {
      return undefined;
    }
    const addressType = getAddressType(this._servingAddresses[0]);
    return `${addressType}:${this._servingAddresses.join(',')}`;
  }

  public get allAddresses() {
    const addressType = getAddressType(this._resolvedAddresses[0]);
    return `${addressType}:${this._resolvedAddresses.join(',')}`;
  }

  public addOrUpdateInstance(instance: ModuleInstance) {
    const index = this._instances.findIndex(i => i.instanceId === instance.instanceId);
    if (!instance.addressType) {
      instance.addressType = getAddressType(instance.address);
    }
    if (index === -1) {
      this._instances.push(instance);
    } else {
      this._instances[index] = instance;
    }
    this.resolveAddresses(instance.instanceId);
  }

  private resolveAddresses(instanceId: string) {
    const instance = this._instances.find(i => i.instanceId === instanceId);
    if (!instance) return;
    const addressType = instance.addressType;
    if (addressType! === 'dns') {
      // We shouldn't need to extend this to resolve ipv6 addresses,
      // since all communications inside the mesh should be ipv4
      dns.resolve(instance.address, (err, addresses) => {
        if (err) {
          throw new Error('DNS resolution failed');
        }
        for (const address of addresses) {
          const formattedAddress = formatAddress(address, addressType!);
          this._resolvedAddresses.push(formattedAddress);
          if (instance.serving) {
            this._servingAddresses.push(formattedAddress);
          }
        }
        this.updateServingList();
      });
    } else {
      this._resolvedAddresses = this._instances.map(i =>
        formatAddress(i.address, i.addressType!),
      );
      this.updateServingList();
    }
    // check if all instances have the same address type
    const allSameType = this._instances.every(i => i.addressType === addressType);
    if (!allSameType) {
      ConduitGrpcSdk.Logger.warn(
        `Module ${this._name} has instances with different address types. Some instances will be unavailable for communication.`,
      );
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
    // get the address type with the most serving instances
    const maxServing = Math.max(...Object.values(servingCount));
    const mostServingType = Object.keys(servingCount).find(
      type => servingCount[type] === maxServing,
    );
    // update the serving addresses
    this._servingAddresses = this._resolvedAddresses.filter(address =>
      this._instances.some(
        i => i.address === address && i.addressType === mostServingType,
      ),
    );
  }

  public removeInstance(instanceId: string) {
    this._instances = this._instances.filter(i => i.instanceId !== instanceId);
  }

  public getInstance(instanceId: string) {
    return this._instances.find(i => i.instanceId === instanceId);
  }
}
