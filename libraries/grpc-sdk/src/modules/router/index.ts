import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';
import { GrpcServer } from '../../classes';
import fs from 'fs';

let protofile_template = `
syntax = "proto3";
package MODULE_NAME.router;

service Router {
 MODULE_FUNCTIONS
}

message RouterRequest {
  string params = 1;
  string path = 2;
  string headers = 3;
  string context = 4;
}

message RouterResponse {
  string result = 1;
  string redirect = 2;
}
`;
export default class Router extends ConduitModule {
  constructor(url: string, private readonly moduleName: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/core.proto');
    this.descriptorObj = 'conduit.core.Router';
    this.initializeClient();
  }

  sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async registerRouter(
    server: GrpcServer,
    paths: any[],
    functions: { [name: string]: Function }
  ): Promise<any> {
    let protoFunctions = '';
    paths.forEach((r) => {
      if (
        protoFunctions.indexOf(
          r.grpcFunction.charAt(0).toUpperCase() + r.grpcFunction.slice(1)
        ) !== -1
      )
        return;
      protoFunctions += `rpc ${
        r.grpcFunction.charAt(0).toUpperCase() + r.grpcFunction.slice(1)
      }(RouterRequest) returns (RouterResponse);\n`;
    });
    let protoFile = protofile_template
      .toString()
      .replace('MODULE_FUNCTIONS', protoFunctions);
    protoFile = protoFile.replace('MODULE_NAME', this.moduleName);

    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protoFile);
    await server.addService(protoPath, this.moduleName + '.router.Router', functions);
    // fs.unlinkSync(protoPath);

    //added sleep as a precaution
    // With this register process there is the chance that the config instances will
    // not have the url of the service yet. In order to avoid this i've added the sleep period.
    // One case is to register to config module X and the admin package to request the url from
    // config module Y that hasn't been informed yet. It may be a rare case but this will help defend against it
    return this.sleep(3000).then(() => this.register(paths, protoFile));
  }

  register(paths: any[], protoFile?: string, url?: string): Promise<any> {
    let protoFunctions = '';
    if (!protoFile) {
      paths.forEach((r) => {
        if (
          protoFunctions.indexOf(
            r.grpcFunction.charAt(0).toUpperCase() + r.grpcFunction.slice(1)
          ) !== -1
        )
          return;
        protoFunctions += `rpc ${
          r.grpcFunction.charAt(0).toUpperCase() + r.grpcFunction.slice(1)
        }(RouterRequest) returns (RouterResponse);\n`;
      });

      protoFile = protofile_template
        .toString()
        .replace('MODULE_FUNCTIONS', protoFunctions);
      protoFile = protoFile.replace('MODULE_NAME', this.moduleName);
    }
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
          resolve('OK');
        }
      });
    });
  }
}
