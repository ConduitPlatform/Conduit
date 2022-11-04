import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';
import { HealthCheckStatus } from '../../types';
import {
  ConfigDefinition,
  ModuleHealthRequest,
  RegisterModuleRequest,
} from '../../protoUtils/core';
import { Indexable } from '../../interfaces';
import ConduitGrpcSdk from '../../index';

export class Config extends ConduitModule<typeof ConfigDefinition> {
  private readonly emitter = new EventEmitter();
  private coreLive = false;
  private readonly _serviceHealthStatusGetter: Function;

  constructor(
    moduleName: string,
    readonly url: string,
    serviceHealthStatusGetter: Function,
    grpcToken?: string,
  ) {
    super(moduleName, 'config', url, grpcToken);
    this.initializeClient(ConfigDefinition);
    this._serviceHealthStatusGetter = serviceHealthStatusGetter;
  }

  getServerConfig() {
    const request = {};
    return this.client!.getServerConfig(request).then(res => {
      return JSON.parse(res.data);
    });
  }

  getModuleUrlByName(name: string): Promise<{ url: string }> {
    if (name === 'core') return Promise.resolve({ url: this.url });
    return this.client!.getModuleUrlByName({ name: name }).then(res => {
      return { url: res.moduleUrl };
    });
  }

  get(name: string) {
    const request = {
      key: name,
    };
    return this.client!.get(request).then(res => {
      return JSON.parse(res.data);
    });
  }

  configure(config: any, schema: any, override: boolean) {
    const request = {
      config: JSON.stringify(config),
      schema: JSON.stringify(schema),
      override,
    };
    return this.client!.configure(request).then(res => {
      return JSON.parse(res.result);
    });
  }

  moduleExists(name: string) {
    const request = {
      moduleName: name,
    };
    return this.client!.moduleExists(request);
  }

  moduleList(): Promise<any[]> {
    const request = {};
    return this.client!.moduleList(request)
      .then(res => res.modules)
      .catch(err => {
        if (this._clientName === 'core') return [];
        throw err;
      });
  }

  getRedisDetails() {
    const request: Indexable = {};
    return this.client!.getRedisDetails(request);
  }

  registerModule(name: string, url: string) {
    const request: RegisterModuleRequest = {
      moduleName: name.toString(),
      url: url.toString(),
    };
    const self = this;
    return this.client!.registerModule(request).then(() => {
      self.coreLive = true;
    });
  }

  moduleHealthProbe(name: string, url: string) {
    const request: ModuleHealthRequest = {
      moduleName: name.toString(),
      url,
      status: this._serviceHealthStatusGetter(),
    };
    const self = this;
    this.client!.moduleHealthProbe(request)
      .then(res => {
        if (!res && self.coreLive) {
          ConduitGrpcSdk.Logger.warn('Core unhealthy');
          self.coreLive = false;
        } else if (res && !self.coreLive) {
          ConduitGrpcSdk.Logger.log('Core is live');
          self.coreLive = true;
          self.watchModules();
        }
      })
      .catch(e => {
        if (self.coreLive) {
          ConduitGrpcSdk.Logger.warn('Core unhealthy');
          self.coreLive = false;
        }
      });
  }

  getModuleWatcher() {
    return this.emitter;
  }

  async watchModules() {
    const self = this;
    this.emitter.setMaxListeners(150);
    self.emitter.emit('serving-modules-update', await self.moduleList().catch());
    try {
      const call = this.client!.watchModules({});
      for await (const data of call) {
        self.emitter.emit('serving-modules-update', data.modules);
      }
    } catch (error) {
      self.coreLive = false;
      ConduitGrpcSdk.Logger.warn('Core unhealthy');
    }
  }
}
