import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';

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
