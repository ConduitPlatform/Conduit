import * as grpc from "grpc";
import path from "path";
import {ConduitModule} from "../../interfaces/ConduitModule";

let protoLoader = require("@grpc/proto-loader");

export default class InMemoryStore implements ConduitModule{
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;

  constructor(url: string) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    var packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "../../proto/in-memory-store.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    var store = protoDescriptor.inmemorystore.InMemoryStore;
    this.client = new store(this._url, grpc.credentials.createInsecure());
    this.active = true;
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig({ newConfig: JSON.stringify(newConfig) }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(JSON.parse(res.updatedConfig));
        }
      });
    });
  }

  get(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.get(
        {
          key: key,
        },
        (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(JSON.parse(res));
          }
        }
      );
    });
  }

  store(key: string, data: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.store(
        {
          key: key,
          data: data.toString(),
        },
        (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        }
      );
    });
  }
}
