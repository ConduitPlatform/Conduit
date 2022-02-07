import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';
import { GrpcServer } from '../../classes';
import fs from 'fs';
import { RouterClient, SocketData } from '../../protoUtils/core';
import { wrapRouterGrpcFunction } from '../../helpers';
import { createProtoFunctions } from '../../helpers/RoutingUtilities';

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

message SocketRequest {
  string event = 1;
  string socketId = 2;
  string params = 3;
  string context = 4;
}

message SocketResponse {
  string event = 1;
  string data = 2;
  repeated string receivers = 3;
  repeated string rooms = 4;
}
`;

export class Router extends ConduitModule<RouterClient> {
  constructor(private readonly moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(RouterClient);
  }

  getFormattedModuleName() {
    return this.moduleName.replace('-', '_');
  }

  sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async registerRouter(
    server: GrpcServer,
    paths: any[],
    functions: { [name: string]: Function },
  ): Promise<any> {
    const protoFunctions = createProtoFunctions(paths);
    let protoFile = protofile_template
      .toString()
      .replace('MODULE_FUNCTIONS', protoFunctions);
    protoFile = protoFile.replace('MODULE_NAME', this.getFormattedModuleName());

    let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protoFile);
    await server.addService(
      protoPath,
      this.getFormattedModuleName() + '.router.Router',
      functions,
    );
    // fs.unlinkSync(protoPath);

    //added sleep as a precaution
    // With this register process there is the chance that the config instances will
    // not have the url of the service yet. In order to avoid this i've added the sleep period.
    // One case is to register to config module X and the admin package to request the url from
    // config module Y that hasn't been informed yet. It may be a rare case but this will help defend against it
    return this.sleep(3000).then(() => this.register(paths, protoFile));
  }

  /**
   * @Deprecated
   */
  async registerRouterAsync(
    server: GrpcServer,
    paths: any[],
    functions: { [name: string]: (call: any, callback?: any) => Promise<any> },
  ): Promise<any> {
    let modifiedFunctions: { [name: string]: Function } = {};
    Object.keys(functions).forEach((key) => {
      modifiedFunctions[key] = wrapRouterGrpcFunction(functions[key]);
    });
    return this.registerRouter(server, paths, modifiedFunctions);
  }

  register(paths: any[], protoFile?: string, url?: string): Promise<any> {
    if (!protoFile) {
      const protoFunctions = createProtoFunctions(paths);

      protoFile = protofile_template
        .toString()
        .replace('MODULE_FUNCTIONS', protoFunctions);
      protoFile = protoFile.replace('MODULE_NAME', this.getFormattedModuleName());
    }
    let request = {
      routes: paths,
      protoFile: protoFile,
      routerUrl: url,
    };
    return new Promise((resolve, reject) => {
      this.client?.registerConduitRoute(request, (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve('OK');
        }
      });
    });
  }

  socketPush(data: SocketData) {
    return new Promise((resolve, reject) => {
      this.client?.socketPush(data, (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve('OK');
        }
      });
    });
  }
}
