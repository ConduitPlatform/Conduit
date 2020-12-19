import * as grpc from "grpc";
import path from "path";

let protoLoader = require("@grpc/proto-loader");

export default class CMS {
  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;

  constructor(url: string) {
    this._url = url;
    this.initializeClient();
  }

  initializeClient() {
    if (this.client) return;
    var packageDefinition = protoLoader.loadSync(path.resolve(__dirname, "../../proto/cms.proto"), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    var authentication = protoDescriptor.cms.CMS;
    this.client = new authentication(this._url, grpc.credentials.createInsecure());
    this.active = true;
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }
}
