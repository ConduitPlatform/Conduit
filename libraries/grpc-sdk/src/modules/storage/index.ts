import * as grpc from "grpc";
import path from "path";

let protoLoader = require("@grpc/proto-loader");

export default class Storage {
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;

  constructor(url: string) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    var packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "../../proto/storage.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    var storage = protoDescriptor.storage.Storage;
    this.client = new storage(this._url, grpc.credentials.createInsecure());
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

  getFile(id: string) {
    return new Promise((resolve, reject) => {
      this.client.getFile({ id }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(JSON.parse(res.fileDocument));
        }
      });
    });
  }

  createFile(name: string, mimeType: string, data: string, folder: string) {
    return new Promise((resolve, reject) => {
      this.client.createFile({ name, mimeType, data, folder }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(JSON.parse(res.fileDocument));
        }
      });
    });
  }
}
