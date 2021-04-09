import path from 'path';
import fs from 'fs';
import grpc from 'grpc';
import {
  ConduitRoute,
  ConduitRouteParameters,
  ConduitMiddleware, ConduitSocket,
} from '@quintessential-sft/conduit-sdk';

let protoLoader = require('@grpc/proto-loader');

export function grpcToConduitRoute(
  request: any,
  moduleName?: string
): (ConduitRoute | ConduitMiddleware | ConduitSocket)[] {
  let finalRoutes: (ConduitRoute | ConduitMiddleware)[] = [];
  let protofile = request.protoFile;
  let routes: [{ options: any; returns?: any; grpcFunction: string } | SocketProtoDescription] = request.routes;
  let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
  fs.writeFileSync(protoPath, protofile);
  var packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  let routerDescriptor: any = grpc.loadPackageDefinition(packageDefinition);
  //this can break everything change it
  while (Object.keys(routerDescriptor)[0] !== 'Router') {
    routerDescriptor = routerDescriptor[Object.keys(routerDescriptor)[0]];
  }
  routerDescriptor = routerDescriptor[Object.keys(routerDescriptor)[0]];
  let serverIp = request.routerUrl;
  let client = new routerDescriptor(serverIp, grpc.credentials.createInsecure(), {
    'grpc.max_receive_message_length': 1024 * 1024 * 100,
    'grpc.max_send_message_length': 1024 * 1024 * 100,
  });
  routes.forEach((r) => {
    let handler = (req: ConduitRouteParameters) => {
      let request = {
        params: req.params ? JSON.stringify(req.params) : null,
        path: req.path,
        headers: JSON.stringify(req.headers),
        context: JSON.stringify(req.context),
      };
      return new Promise((resolve, reject) => {
        client[r.grpcFunction](request, (err: any, result: any) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
    };
    let options: any = r.options;
    for (let k in options) {
      if (!options.hasOwnProperty(k) || options[k].length === 0) continue;
      try {
        options[k] = JSON.parse(options[k]);
      } catch (e) {}
    }
    let returns: any = r.returns;
    if (returns) {
      for (let k in returns) {
        if (!returns.hasOwnProperty(k) || returns[k].length === 0) continue;
        try {
          returns[k] = JSON.parse(returns[k]);
        } catch (e) {}
      }
    }
    if (moduleName) {
      if (
        options.path.startsWith(`/${moduleName}`) ||
        options.path.startsWith(`/hook/${moduleName}`)
      ) {
        return;
      }
      if (
        options.path.startsWith(`/hook`) &&
        !options.path.startsWith(`/hook/${moduleName}`)
      ) {
        options.path = options.path.replace('/hook', `/hook/${moduleName!.toString()}`);
      } else {
        options.path = `/${moduleName!.toString()}${options.path.toString()}`;
      }
    }

    if (returns) {
      finalRoutes.push(new ConduitRoute(options, returns, handler));
    } else {
      finalRoutes.push(new ConduitMiddleware(options, r.grpcFunction, handler));
    }
  });
  return finalRoutes;
}
