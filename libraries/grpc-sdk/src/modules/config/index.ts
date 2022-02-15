import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';
import { ConfigDefinition, RegisterModuleRequest } from '../../protoUtils/core';

export class Config extends ConduitModule<typeof ConfigDefinition> {
  private emitter = new EventEmitter();
  private coreLive = false;

  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(ConfigDefinition);
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

  addFieldstoConfig(config: any, name: string): Promise<any> {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };
    return this.client!.addFieldstoConfig(request)
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
    return this.client!.moduleList(request).then(res => res.modules);
  }

  getRedisDetails(): Promise<any> {
    let request: { [key: string]: any } = {};
    return this.client!.getRedisDetails(request);
  }

  registerModule(name: string, url: string): Promise<any> {
    // TODO make newConfigSchema required when all modules provide their config schema
    let request: RegisterModuleRequest = {
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
        setInterval(() => self.moduleHealthProbe.bind(self)(name, url), 2000);
        return r;
      });
  }

  moduleHealthProbe(name: string, url: string) {
    let request: { [key: string]: any } = {
      moduleName: name.toString(),
      url: url.toString(),
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
    let call;
    try {
      call = this.client!.watchModules({});
      for await (let data of call) {
        self.emitter.emit('module-registered', data.modules);
      }
    } catch (error) {
      console.error('Connection to grpc server closed');
    }


  }
}
