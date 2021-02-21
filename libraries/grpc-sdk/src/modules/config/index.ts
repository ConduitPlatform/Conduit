import path from 'path';
import { EventEmitter } from 'events';
import { ConduitModule } from '../../classes/ConduitModule';

export default class Config extends ConduitModule {
  constructor(url: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/core.proto');
    this.descriptorObj = 'conduit.core.Config';
    this.initializeClient();
  }

  getServerConfig(): Promise<any> {
    let request = {};
    return new Promise((resolve, reject) => {
      this.client.getServerConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(JSON.parse(res.data));
        }
      });
    });
  }

  getModuleUrlByInstance(instancePeer: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.getModuleUrlByInstance({ instancePeer }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res.moduleUrl);
        }
      });
    });
  }

  get(name: string): Promise<any> {
    let request = {
      key: name,
    };
    return new Promise((resolve, reject) => {
      this.client.get(request, (err: any, res: any) => {
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
      this.client.updateConfig(request, (err: any, res: any) => {
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
      this.client.addFieldstoConfig(request, (err: any, res: any) => {
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
      this.client.moduleExists(request, (err: any, res: any) => {
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
      this.client.moduleList(request, (err: any, res: any) => {
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
      this.client.getRedisDetails(request, (err: any, res: any) => {
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
    let request: { [key: string]: any } = {
      moduleName: name.toString(),
      url: url.toString(),
    };
    const self = this;
    return new Promise((resolve, reject) => {
      this.client.registerModule(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
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
    this.client.moduleHealthProbe(request, () => {});
  }

  watchModules() {
    let emitter = new EventEmitter();
    emitter.setMaxListeners(150);
    let call = this.client.watchModules({});
    call.on('data', function (data: any) {
      emitter.emit('module-registered', data.modules);
    });
    call.on('end', function () {
      // The server has finished sending
      console.log('Stream ended');
    });
    call.on('error', function () {
      // An error has occurred and the stream has been closed.
      console.error('Connection to grpc server closed');
    });
    call.on('status', function (status: any) {
      console.error('Connection status changed to : ', status);
    });

    return emitter;
  }

  registerModulesConfig(moduleName: string, newModulesConfigSchema: any) {
    let request = {
      moduleName,
      newModulesConfigSchema: JSON.stringify(newModulesConfigSchema),
    };
    return new Promise((resolve, reject) => {
      this.client.registerModulesConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve({});
        }
      });
    });
  }
}
