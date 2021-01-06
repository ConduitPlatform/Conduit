import * as grpc from "grpc";
import path from "path";
import { EventEmitter } from "events";

let protoLoader = require("@grpc/proto-loader");

export default class Config {
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;
  
  constructor(url: string) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    var packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "../../proto/core.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    var config = protoDescriptor.conduit.core.Config;
    this.client = new config(this._url, grpc.credentials.createInsecure(), {
      "grpc.max_receive_message_length": 1024 * 1024 * 100,
      "grpc.max_send_message_length": 1024 * 1024 * 100
    });
    this.active = true;
  }

  getServerConfig(): Promise<any> {
    let request = {};
    return new Promise((resolve, reject) => {
      this.client.getServerConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(JSON.parse(res.data));
        }
      });
    });
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }

  get(name: string): Promise<any> {
    let request = {
      key: name,
    };
    return new Promise((resolve, reject) => {
      this.client.get(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
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
          reject(err || "Something went wrong");
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
          reject(err || "Something went wrong");
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
          reject(err || "Something went wrong");
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
          reject(err || "Something went wrong");
        } else {
          resolve(res.modules);
        }
      });
    });
  }

  getRedisDetails(): Promise<any>{
    let request: { [key: string]: any } = {};
    return new Promise((resolve, reject) => {
      this.client.getRedisDetails(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
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
          reject(err || "Something went wrong");
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
    this.client.moduleHealthProbe(request, (err: any, res: any) => {});
  }

  watchModules() {
    let emitter = new EventEmitter();
    let call = this.client.watchModules({});
    call.on("data", function (data: any) {
      emitter.emit("module-registered", data.modules);
    });
    call.on("end", function () {
      // The server has finished sending
      console.log("Stream ended");
    });
    call.on("error", function (e: any) {
      // An error has occurred and the stream has been closed.
      console.error("Connection to grpc server closed");
    });
    call.on("status", function (status: any) {
      console.error("Connection status changed to : ", status);
    });

    return emitter;
  }

  registerModulesConfig(moduleName: string, newModulesConfigSchema: any) {
    let request = { moduleName, newModulesConfigSchema: JSON.stringify(newModulesConfigSchema) };
    return new Promise((resolve, reject) => {
      this.client.registerModulesConfig(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve({});
        }
      });
    });
  }
}
