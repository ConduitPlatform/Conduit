import * as grpc from "grpc";
import path from "path";
import {ConduitModule} from "../../interfaces/ConduitModule";

let protoLoader = require("@grpc/proto-loader");

let protofile_template = `
syntax = "proto3";
package MODULE_NAME.admin;

service Admin {
 MODULE_FUNCTIONS
}

// all admin requests accept the params,headers and context objects as stringified json
message AdminRequest {
  string params = 1;
  string headers = 2;
  string context = 3;
}
// all admin responses return their results as stringified json
message AdminResponse {
  string result = 1;
}
`

export default class Admin implements ConduitModule{

  private client: grpc.Client | any;
  private readonly _url: string;
  active: boolean = false;


  constructor(url: string, private readonly moduleName: string) {
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
    var admin = protoDescriptor.conduit.core.Admin;
    this.client = new admin(this._url, grpc.credentials.createInsecure(), {
      "grpc.max_receive_message_length": 1024 * 1024 * 100,
      "grpc.max_send_message_length": 1024 * 1024 * 100
    });
    this.active = true;
  }

  closeConnection() {
    this.client.close();
    this.client = null;
    this.active = false;
  }

  register(paths: any[], protoFile?: string, serverUrl?: string): Promise<any> {
    let grpcPathArray: any[] = [];
    let protoFunctions = "";
    paths.forEach((r) => {
      let obj = {
        path: r.path,
        method: r.method,
        grpcFunction: r.protoName,
      };
      if(!protoFile){
        protoFunctions+= `rpc ${r.protoName.charAt(0).toUpperCase() +r.protoName.slice(1) }(AdminRequest) returns (AdminResponse);\n`;
      }
      grpcPathArray.push(obj);
    });
    if(!protoFile){
      protoFile =  protofile_template.toString().replace("MODULE_FUNCTIONS", protoFunctions);
      protoFile =  protoFile.replace("MODULE_NAME", this.moduleName);
    }

    let request = {
      routes: grpcPathArray,
      protoFile: protoFile,
      adminUrl: serverUrl,
    };

    return new Promise((resolve, reject) => {
      this.client.registerAdminRoute(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || "Something went wrong");
        } else {
          resolve(res.modules);
        }
      });
    });
  }
}
