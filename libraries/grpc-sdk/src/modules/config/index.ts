import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';
import { HealthCheckStatus } from '../../types';
import { ConfigDefinition, RegisterModuleRequest, ModuleHealthRequest } from '../../protoUtils/core';
import { Indexable } from '../../interfaces';

export class Config extends ConduitModule<typeof ConfigDefinition> {
  private readonly emitter = new EventEmitter();
  private coreLive = false;
  private readonly _serviceHealthStatusGetter: Function;

  constructor(moduleName: string, url: string, serviceHealthStatusGetter: Function, grpcToken?: string) {
    super(moduleName, 'config', url, grpcToken);
    this.initializeClient(ConfigDefinition);
    this._serviceHealthStatusGetter = serviceHealthStatusGetter;
  }

  getServerConfig() {
    let request = {};
    return this.client!.getServerConfig(request)
      .then(res => {
        return JSON.parse(res.data);
      });
  }

  getModuleUrlByName(
    name: string,
  ): Promise<{ url: string }> {
    return this.client!.getModuleUrlByName({ name: name })
      .then(res => {
        return { url: res.moduleUrl };
      });
  }

  get(name: string) {
    let request = {
      key: name,
    };
    return this.client!.get(request)
      .then(res => {
        return JSON.parse(res.data);
      });
  }

  updateConfig(config: any, name: string) {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };

    return this.client!.updateConfig(request)
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  addFieldsToConfig(config: any, name: string) {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };
    return this.client!.addFieldsToConfig(request)
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  moduleExists(name: string) {
    let request = {
      moduleName: name,
    };
    return this.client!.moduleExists(request);
  }

  moduleList(): Promise<any[]> {
    let request = {};
    return this.client!.moduleList(request)
      .then(res => res.modules)
      .catch(err => {
        if (this._clientName === 'core') return [];
        throw err;
      });
  }

  getRedisDetails() {
    let request: Indexable = {};
    return this.client!.getRedisDetails(request);
  }

  registerModule(
    name: string,
    url: string,
    healthStatus: Omit<HealthCheckStatus, HealthCheckStatus.SERVICE_UNKNOWN>,
  ) {
    const request: RegisterModuleRequest = {
      moduleName: name.toString(),
      url: url.toString(),
      healthStatus: healthStatus as number,
    };
    const self = this;
    return this.client!.registerModule(request)
      .then(res => {
        self.coreLive = true;
        return res.result;
      })
      .then((r) => {
        setInterval(() => self.moduleHealthProbe.bind(self)(name, url), 2000);
        return r;
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
          console.log('Core unhealthy');
          self.coreLive = false;
        } else if (res && !self.coreLive) {
          console.log('Core is live');
          self.coreLive = true;
          self.watchModules();
        }
      })
      .catch(e => {
        if (self.coreLive) {
          console.log('Core unhealthy');
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
    try {
      const call = this.client!.watchModules({});
      for await (let data of call) {
        self.emitter.emit('serving-modules-update', data.modules);
      }
    } catch (error) {
      console.error('Connection to gRPC server closed');
    }
  }
}
