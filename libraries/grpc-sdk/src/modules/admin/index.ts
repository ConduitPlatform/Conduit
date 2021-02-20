import path from "path";
import {ConduitModule} from "../../classes/ConduitModule";
import * as grpc from "grpc";
import {addServiceToServer} from "../../helpers";
import fs from "fs";

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

export default class Admin extends ConduitModule {

    constructor(url: string, private readonly moduleName: string) {
        super(url);
        this.protoPath = path.resolve(__dirname, "../../proto/core.proto");
        this.descriptorObj = "conduit.core.Admin";
        this.initializeClient();
    }

    registerAdmin(server: grpc.Server, paths: any[], functions: { [name: string]: Function }): Promise<any> {
        let protoFunctions = "";
        paths.forEach((r) => {
            protoFunctions += `rpc ${r.protoName.charAt(0).toUpperCase() + r.protoName.slice(1)}(AdminRequest) returns (AdminResponse);\n`;
        });
        let protoFile = protofile_template.toString().replace("MODULE_FUNCTIONS", protoFunctions);
        protoFile = protoFile.replace("MODULE_NAME", this.moduleName);

        let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
        fs.writeFileSync(protoPath, protoFile);

        addServiceToServer(server, protoPath, this.moduleName + ".admin.Admin", functions);
        fs.unlinkSync(protoPath);

        return this.register(paths, protoFile);
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
            if (!protoFile) {
                protoFunctions += `rpc ${r.protoName.charAt(0).toUpperCase() + r.protoName.slice(1)}(AdminRequest) returns (AdminResponse);\n`;
            }
            grpcPathArray.push(obj);
        });
        if (!protoFile) {
            protoFile = protofile_template.toString().replace("MODULE_FUNCTIONS", protoFunctions);
            protoFile = protoFile.replace("MODULE_NAME", this.moduleName);
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
