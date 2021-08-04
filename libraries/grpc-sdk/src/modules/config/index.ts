import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';
import { ConfigClient, RegisterModuleRequest } from '../../protoUtils/core';

export default class Config extends ConduitModule<ConfigClient> {
  private emitter = new EventEmitter();
  private coreLive = false;

  constructor(url: string) {
    super(url);
    this.initializeClient(ConfigClient);
  }

  getServerConfig(): Promise<any> {
    let request = {};
    return new Promise((resolve, reject) => {
      this.client?.getServerConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.data));
        }
      });
    });
  }

  getModuleUrlByInstance(
    instancePeer: string
  ): Promise<{ url: string; moduleName: string }> {
    return new Promise((resolve, reject) => {
      this.client?.getModuleUrlByInstance({ instancePeer }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve({ url: res.moduleUrl, moduleName: res.moduleName });
        }
      });
    });
  }

  get(name: string): Promise<any> {
    let request = {
      key: name,
    };
    return new Promise((resolve, reject) => {
      this.client?.get(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.data));
        }
      });
    });
  }

  updateConfig(config: any, name: string): Promise<any> {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };

    return new Promise((resolve, reject) => {
      this.client?.updateConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.result));
        }
      });
    });
  }

  addFieldstoConfig(config: any, name: string): Promise<any> {
    let request = {
      config: JSON.stringify(config),
      moduleName: name,
    };

    return new Promise((resolve, reject) => {
      this.client?.addFieldstoConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.result));
        }
      });
    });
  }

  moduleExists(name: string): Promise<any> {
    let request = {
      moduleName: name,
    };
    return new Promise((resolve, reject) => {
      this.client?.moduleExists(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res.modules);
        }
      });
    });
  }

  moduleList(): Promise<any[]> {
    let request = {};
    return new Promise((resolve, reject) => {
      this.client?.moduleList(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res.modules);
        }
      });
    });
  }

  getRedisDetails(): Promise<any> {
    let request: { [key: string]: any } = {};
    return new Promise((resolve, reject) => {
      this.client?.getRedisDetails(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  registerModule(name: string, url: string): Promise<any> {
    // TODO make newConfigSchema required when all modules provide their config schema
    let request: RegisterModuleRequest = {
      moduleName: name.toString(),
      url: url.toString(),
    };
    const self = this;
    return new Promise((resolve, reject) => {
      this.client?.registerModule(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          self.coreLive = true;
          resolve(res.modules);
        }
      });
    }).then((r) => {
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
    //@ts-ignore
    this.client.moduleHealthProbe(request, (err: any, res: any) => {
      if (err || !res) {
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
    });
  }

  watchModules() {
    const self = this;
    this.emitter.setMaxListeners(150);
    let call = this.client!.watchModules({});
    call.on('data', function (data: any) {
      self.emitter.emit('module-registered', data.modules);
    });
    call.on('end', function () {
      // The server has finished sending
      console.log('Stream ended');
    });
    call.on('error', function () {
      // An error has occurred and the stream has been closed.
      call.cancel();
      //clear event listeners once connection has been closed
      call.removeAllListeners();
      console.error('Connection to grpc server closed');
    });
    call.on('status', function (status: any) {
      console.error('Connection status changed to : ', status);
    });

    return self.emitter;
  }
}
