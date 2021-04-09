import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';
import { GrpcServer } from '../../classes';
import fs from 'fs';
import { SocketProtoDescription } from '../../interfaces';

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
}

message SocketResponse {
  string event = 1;
  string data = 2;
  repeated string receivers = 3;
  repeated string rooms = 4;
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
    const protoFunctions = this.createProtoFunctions(paths);
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
    if (!protoFile) {
      const protoFunctions = this.createProtoFunctions(paths);

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

  private createProtoFunctions(paths: any[]) {
    let protoFunctions = '';

    paths.forEach((r) => {
      if (r.hasOwnProperty('events')) {
        protoFunctions += this.createProtoFunctionsForSocket(r, protoFunctions);
      } else {
        protoFunctions += this.createProtoFunctionForRoute(r, protoFunctions);
      }
    });

    return protoFunctions;
  }

  private createProtoFunctionsForSocket(path: SocketProtoDescription, protoFunctions: string) {
    let newFunctions = '';

    Object.keys(path.events).forEach((event) => {
      const newFunction = this.createGrpcFunctionName(path.events[event].grpcFunction);

      if (protoFunctions.indexOf(newFunction) !== -1) {
        return;
      }

      newFunctions += `rpc ${newFunction}(SocketRequest) returns (SocketResponse);\n`;
    });

    return newFunctions;
  }

  private createProtoFunctionForRoute(path: any, protoFunctions: string) {
    const newFunction = this.createGrpcFunctionName(path.grpcFunction);

    if (protoFunctions.indexOf(newFunction) !== -1) {
      return '';
    }

    return `rpc ${newFunction}(RouterRequest) returns (RouterResponse);\n`;
  }

  private createGrpcFunctionName(grpcFunction: string) {
    return grpcFunction.charAt(0).toUpperCase() + grpcFunction.slice(1);
  }
}
