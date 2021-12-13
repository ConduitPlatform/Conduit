import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';
import fs from 'fs';
import { GrpcServer } from '../../classes';
import { AdminClient } from '../../protoUtils/core';
import { wrapRouterGrpcFunction } from '../../helpers';

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
  string redirect = 2;
}
`;

export class Admin extends ConduitModule<AdminClient> {
  constructor(private readonly moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(AdminClient);
  }

  sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async registerAdminAsync(
    server: GrpcServer,
    paths: any[],
    functions: { [name: string]: (call: any, callback?: any) => Promise<any> }
  ): Promise<any> {
    let modifiedFunctions: { [name: string]: Function } = {};
    Object.keys(functions).forEach((key) => {
      modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key]);
    });
    let protoFunctions = '';
    paths.forEach((r) => {
      protoFunctions += `rpc ${
        r.grpcFunction.charAt(0).toUpperCase() + r.grpcFunction.slice(1)
      }(AdminRequest) returns (AdminResponse);\n`;
    });
    let protoFile = protofile_template
      .toString()
      .replace('MODULE_FUNCTIONS', protoFunctions);
    protoFile = protoFile.replace('MODULE_NAME', this.moduleName);

    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protoFile);
    await server.addService(protoPath, this.moduleName + '.admin.Admin', modifiedFunctions);
    // fs.unlinkSync(protoPath);

    //added sleep as a precaution
    // With this register process there is a chance that the config instances will
    // not have the url of the service yet. In order to avoid this I've added the sleep period.
    // One case is to register to config module X and the admin package to request the url from
    // config module Y that hasn't been informed yet. It may be a rare case but this will help defend against it.
    return this.sleep(3000).then(() => this.register(paths, protoFile));
  }

  register(paths: any[], protoFile?: string, serverUrl?: string): Promise<any> {
    let protoFunctions = '';
    paths.forEach((r) => {
      if (!protoFile) {
        protoFunctions += `rpc ${
          r.protoName.charAt(0).toUpperCase() + r.protoName.slice(1)
        }(AdminRequest) returns (AdminResponse);\n`;
      }
    });
    if (!protoFile) {
      protoFile = protofile_template
        .toString()
        .replace('MODULE_FUNCTIONS', protoFunctions);
      protoFile = protoFile.replace('MODULE_NAME', this.moduleName);
    }

    let request = {
      routes: paths,
      protoFile: protoFile,
      adminUrl: serverUrl,
    };

    return new Promise((resolve, reject) => {
      this.client?.registerAdminRoute(request, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res.modules);
        }
      });
    });
  }
}
