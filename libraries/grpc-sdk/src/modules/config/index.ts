import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';
import { ConfigDefinition, RegisterModuleRequest } from '../../protoUtils/core';
import { ClientError, Status } from 'nice-grpc';

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

  getModuleUrlByInstance(
    instancePeer: string,
  ): Promise<{ url: string; moduleName: string }> {
    return this.client!.getModuleUrlByInstance({ instancePeer })
      .then(res => {
        return { url: res.moduleUrl, moduleName: res.moduleName };
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
        if (!res) {
          if (self.coreLive) {
            console.log('Core unhealthy');
            self.coreLive = false;
          }
        } else {
          if (!self.coreLive) {
            console.log('Core is live');
            self.coreLive = true;
            self.watchModules();
          }
        }
      })
      .catch(e => {
        if (self.coreLive) {
          console.log('Core unhealthy');
          self.coreLive = false;
        }
      });
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
    }catch (error){
      if (error instanceof ClientError && error.code === Status.NOT_FOUND) {
        // response = null;
      } else {
        // throw error;
      }
      // An error has occurred and the stream has been closed.
      // call.cancel();
      //clear event listeners once connection has been closed
      // call.removeAllListeners();
      console.error('Connection to grpc server closed');
    }
    // call.on('end', function() {
    //   // The server has finished sending
    //   console.log('Stream ended');
    // });
    // call.on('status', function(status: any) {
    //   console.error('Connection status changed to : ', status);
    // });

    return self.emitter;
  }
}
