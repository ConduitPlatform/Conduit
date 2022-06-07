import path from 'path';
import fs from 'fs';
import {
  credentials,
  Metadata,
  loadPackageDefinition,
  GrpcObject,
  ServiceClientConstructor,
  Client,
} from '@grpc/grpc-js';
import {
  ConduitSocket,
  ConduitMiddleware,
  ConduitSocketEvent,
  ConduitSocketParameters,
  EventResponse,
  JoinRoomResponse,
  SocketProtoDescription,
  instanceOfSocketProtoDescription,
  RouteT,
} from '../interfaces';
import { ConduitRoute, ConduitRouteReturnDefinition } from '../classes';
import {
  ConduitRouteOptions,
  ConduitRouteParameters,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import { RouterDescriptor } from '../interfaces/RouterDescriptor';

const protoLoader = require('@grpc/proto-loader');

function getDescriptor(protofile: string) {
  let protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
  fs.writeFileSync(protoPath, protofile);
  var packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  fs.unlink(protoPath, () => {});
  return loadPackageDefinition(packageDefinition);
}

export function grpcToConduitRoute(
  routerName: string,
  request: {
    protoFile: string;
    routes: RouteT[];
    routerUrl: string;
  },
  moduleName?: string,
  grpcToken?: string,
): (ConduitRoute | ConduitMiddleware | ConduitSocket)[] {
  let routes = request.routes;

  let routerDescriptor: RouterDescriptor = getDescriptor(request.protoFile);
  //this can break everything change it
  while (Object.keys(routerDescriptor)[0] !== routerName) {
    routerDescriptor = routerDescriptor[Object.keys(routerDescriptor)[0]] as GrpcObject;
  }
  routerDescriptor = routerDescriptor[Object.keys(routerDescriptor)[0]];
  const serverIp = request.routerUrl;
  const client = new (routerDescriptor as ServiceClientConstructor)(
    serverIp,
    credentials.createInsecure(),
    {
      'grpc.max_receive_message_length': 1024 * 1024 * 100,
      'grpc.max_send_message_length': 1024 * 1024 * 100,
    },
  );

  return createHandlers(routes, client, moduleName, grpcToken);
}

function createHandlers(
  routes: RouteT[],
  client: Client,
  moduleName?: string,
  grpcToken?: string,
) {
  const finalRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket)[] = [];

  routes.forEach(r => {
    let route;
    const metadata = new Metadata();
    if (grpcToken) {
      metadata.add('grpc-token', grpcToken);
    }
    if (instanceOfSocketProtoDescription(r)) {
      route = createHandlerForSocket(r, client, metadata, moduleName);
    } else {
      route = createHandlerForRoute(r, client, metadata, moduleName);
    }

    if (route != undefined) {
      finalRoutes.push(route);
    }
  });

  return finalRoutes;
}

function createHandlerForRoute(
  route: { options: Indexable; returns?: Indexable; grpcFunction: string },
  client: any,
  metadata: Metadata,
  moduleName?: string,
) {
  const handler = (req: ConduitRouteParameters) => {
    let request = {
      params: req.params ? JSON.stringify(req.params) : null,
      path: req.path,
      headers: JSON.stringify(req.headers),
      context: JSON.stringify(req.context),
    };
    return new Promise((resolve, reject) => {
      client[route.grpcFunction](
        request,
        metadata,
        (err: Error, result: Indexable | string) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        },
      );
    });
  };

  let options: Indexable = route.options;
  for (let k in options) {
    if (!options.hasOwnProperty(k) || options[k].length === 0) continue;
    try {
      options[k] = JSON.parse(options[k]);
    } catch (e) {}
  }

  let returns = route.returns;
  if (returns) {
    for (let k in returns) {
      if (!returns.hasOwnProperty(k) || returns[k].length === 0) continue;
      try {
        returns[k] = JSON.parse(returns[k]);
      } catch (e) {}
    }
  }
  if (!options.path.startsWith('/')) {
    options.path = `/${options.path}`;
  }

  if (moduleName) {
    if (
      !(
        options.path.startsWith(`/${moduleName}/`) ||
        options.path.startsWith(`/hook/${moduleName}/`)
      )
    ) {
      if (
        options.path.startsWith(`/hook`) &&
        !options.path.startsWith(`/hook/${moduleName}/`)
      ) {
        options.path = options.path.replace('/hook', `/hook/${moduleName!.toString()}`);
      } else {
        options.path = `/${moduleName!.toString()}${options.path.toString()}`;
      }
    }
  }

  if (returns) {
    return new ConduitRoute(
      options as ConduitRouteOptions,
      returns as ConduitRouteReturnDefinition,
      handler,
    );
  } else {
    return new ConduitMiddleware(options, route.grpcFunction, handler);
  }
}

function createHandlerForSocket(
  socket: SocketProtoDescription,
  client: Indexable,
  metadata: Metadata,
  moduleName?: string,
) {
  let eventHandlers = new Map<string, ConduitSocketEvent>();
  const events = JSON.parse(socket.events);
  for (const event in events) {
    let handler = (req: ConduitSocketParameters) => {
      let request = {
        event: req.event,
        socketId: req.socketId,
        params: req.params ? JSON.stringify(req.params) : null,
        context: req.context ? JSON.stringify(req.context) : null,
      };

      return new Promise<EventResponse | JoinRoomResponse>((resolve, reject) => {
        client[events[req.event].grpcFunction](
          request,
          metadata,
          (
            err: { code: number; message: string },
            result: EventResponse | JoinRoomResponse,
          ) => {
            if (err) {
              return reject(err);
            }
            resolve(result);
          },
        );
      });
    };

    const socketEvent: ConduitSocketEvent = {
      name: event,
      handler,
    };

    eventHandlers.set(event, socketEvent);
  }

  if (moduleName) {
    if (!socket.options.path.startsWith('/')) {
      socket.options.path = `/${socket.options.path}`;
    }
    if (!socket.options.path.startsWith(`/${moduleName}/`)) {
      socket.options.path = `/${moduleName}${socket.options.path}`;
    }
  }

  return new ConduitSocket(socket.options, eventHandlers);
}
