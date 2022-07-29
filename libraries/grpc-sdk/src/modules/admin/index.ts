import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';
import fs from 'fs';
import { GrpcServer } from '../../classes';
import { AdminDefinition } from '../../protoUtils/core';
import { wrapRouterGrpcFunction } from '../../helpers';
import { sleep } from '../../utilities';
import { Indexable } from '../../interfaces';
import { ParsedRouterRequest } from '../../types';

const protofile_template = `
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
  string path = 4;
}
// all admin responses return their results as stringified json
message AdminResponse {
  string result = 1;
  string redirect = 2;
}
`;

export class Admin extends ConduitModule<typeof AdminDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'admin', url, grpcToken);
    this.initializeClient(AdminDefinition);
  }

  async registerAdminAsync(
    server: GrpcServer,
    paths: Indexable[],
    functions: {
      [name: string]: (call: ParsedRouterRequest, callback?: Indexable) => Promise<any>;
    },
  ): Promise<any> {
    const modifiedFunctions: { [name: string]: Function } = {};
    Object.keys(functions).forEach(key => {
      modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key], 'admin');
    });
    let protoFunctions = '';
    paths.forEach(r => {
      protoFunctions += `rpc ${
        r.grpcFunction.charAt(0).toUpperCase() + r.grpcFunction.slice(1)
      }(AdminRequest) returns (AdminResponse);\n`;
    });
    let protoFile = protofile_template
      .toString()
      .replace('MODULE_FUNCTIONS', protoFunctions);
    protoFile = protoFile.replace('MODULE_NAME', this.moduleName);

    const protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protoFile);
    await server.addService(
      protoPath,
      this.moduleName + '.admin.Admin',
      modifiedFunctions,
    );
    // fs.unlinkSync(protoPath);

    //added sleep as a precaution
    // With this register process there is a chance that the config instances will
    // not have the url of the service yet. In order to avoid this I've added the sleep period.
    // One case is to register to config module X and the admin package to request the url from
    // config module Y that hasn't been informed yet. It may be a rare case but this will help defend against it.
    return sleep(3000).then(() => this.register(paths, protoFile));
  }

  register(paths: Indexable[], protoFile?: string, serverUrl?: string): Promise<any> {
    let protoFunctions = '';
    paths.forEach(r => {
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

    const request = {
      routes: paths,
      protoFile: protoFile,
      adminUrl: serverUrl,
    };

    return this.client!.registerAdminRoute(request);
  }
}
