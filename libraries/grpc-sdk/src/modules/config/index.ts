import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';
import { ConfigDefinition, RegisterModuleRequest, ModuleHealthRequest } from '../../protoUtils/core';

export class Config extends ConduitModule<typeof ConfigDefinition> {
  private readonly emitter = new EventEmitter();
  private coreLive = false;
  private readonly _serviceHealthStatusGetter: Function;

  constructor(moduleName: string, url: string, serviceHealthStatusGetter: Function) {
    super(moduleName, 'config', url);
    this.initializeClient(ConfigDefinition);
    this._serviceHealthStatusGetter = serviceHealthStatusGetter;
  }

  getServerConfig(): Promise<any> {
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

  get(name: string): Promise<any> {
    let request = {
      key: name,
    };
    return this.client!.get(request)
      .then(res => {
        return JSON.parse(res.data);
      });
  }

  updateConfig(config: any, name: string): Promise<any> {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };

    return this.client!.updateConfig(request)
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  addFieldsToConfig(config: any, name: string): Promise<any> {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };
    return this.client!.addFieldsToConfig(request)
      .then(res => {
        return JSON.parse(res.result);
      });
  }

  moduleExists(name: string): Promise<any> {
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

  getRedisDetails(): Promise<any> {
    let request: { [key: string]: any } = {};
    return this.client!.getRedisDetails(request);
  }

  registerModule(name: string, url: string): Promise<any> {
    // TODO make newConfigSchema required when all modules provide their config schema
    const request: RegisterModuleRequest = {
      moduleName: name.toString(),
      url: url.toString(),
    };
    const self = this;
    return this.client!.registerModule(request)
      .then(res => {
        self.coreLive = true;
        return res.result;
      })
      .then((r) => {
        setInterval(() => self.moduleHealthProbe.bind(self)(name), 2000);
        return r;
      });
  }

  moduleHealthProbe(name: string) {
    const request: ModuleHealthRequest = {
      moduleName: name.toString(),
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
