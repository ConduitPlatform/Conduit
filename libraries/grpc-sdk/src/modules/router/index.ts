import * as grpc from "grpc";
import path from "path";

let protoLoader = require("@grpc/proto-loader");

export default class Router {
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
    var router = protoDescriptor.conduit.core.Router;
    this.client = new router(this._url, grpc.credentials.createInsecure());
    this.active = true;
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }

  register(paths: any[], protoFile: string, url: string): Promise<any> {
    let request = {
      routes: paths,
      protoFile: protoFile,
      routerUrl: url,
    };
    return new Promise((resolve, reject) => {
      this.client.registerConduitRoute(request, (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve("OK");
        }
      });
    });
  }
}
