import path from 'path';
import {
  Client,
  credentials,
  loadPackageDefinition,
  Metadata,
  ServiceClientConstructor,
} from '@grpc/grpc-js';
import {
  ConduitRouteOptions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  Indexable,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitMiddleware,
  ConduitSocket,
  ConduitSocketEvent,
  ConduitSocketParameters,
  EventResponse,
  instanceOfSocketProtoDescription,
  JoinRoomResponse,
  ProxyRouteT,
  RouteT,
  SocketProtoDescription,
} from '../interfaces/index.js';
import { ConduitRoute, instanceOfConduitProxy, ProxyRoute } from '../classes/index.js';

const protoLoader = require('@grpc/proto-loader');

function getDescriptor() {
  const protoPath = path.resolve(__dirname, '../module.proto');
  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return loadPackageDefinition(packageDefinition);
}

export function grpcToConduitRoute(
  routerName: string,
  request: {
    routes: RouteT[] | ProxyRouteT[];
    routerUrl: string;
  },
  moduleName?: string,
  grpcToken?: string,
): (ConduitRoute | ConduitMiddleware | ConduitSocket | ProxyRoute)[] {
  const routes = request.routes;

  let routerDescriptor: any = getDescriptor();
  if (routerName === 'Router') {
    routerDescriptor = routerDescriptor.conduit.module.v1.ClientRouter;
  } else {
    routerDescriptor = routerDescriptor.conduit.module.v1.AdminRouter;
  }
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

export function proxyToConduitRoute(
  routes: ProxyRouteT[],
  moduleName?: string,
): ProxyRoute[] {
  return routes.map(r => createHandlerForProxy(r, moduleName));
}

function createHandlers(
  routes: RouteT[] | ProxyRouteT[],
  client: Client,
  moduleName?: string,
  grpcToken?: string,
) {
  const finalRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket | ProxyRoute)[] =
    [];

  routes.forEach(r => {
    let route;
    const metadata = new Metadata();
    if (grpcToken) {
      metadata.add('grpc-token', grpcToken);
    }
    if (instanceOfSocketProtoDescription(r)) {
      route = createHandlerForSocket(r, client, metadata, moduleName);
    } else if (instanceOfConduitProxy(r)) {
      route = createHandlerForProxy(r.options, moduleName);
    } else {
      route = createHandlerForRoute(r as RouteT, client, metadata, moduleName);
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
    const request = {
      params: req.params ? JSON.stringify(req.params) : null,
      urlParams: req.urlParams ? JSON.stringify(req.urlParams) : null,
      queryParams: req.queryParams ? JSON.stringify(req.queryParams) : null,
      bodyParams: req.bodyParams ? JSON.stringify(req.bodyParams) : null,
      path: req.path,
      headers: JSON.stringify(req.headers),
      context: JSON.stringify(req.context),
      cookies: JSON.stringify(req.cookies),
      functionName: route.grpcFunction,
    };
    return new Promise((resolve, reject) => {
      client.route(request, metadata, (err: Error, result: Indexable | string) => {
        if (err) {
          return reject(err);
        }
        resolve(result);
      });
    });
  };

  const options: Indexable = route.options;
  for (const k in options) {
    if (!options.hasOwnProperty(k) || options[k].length === 0) continue;
    try {
      options[k] = JSON.parse(options[k]);
    } catch (e) {}
  }

  const returns = route.returns;
  if (returns) {
    for (const k in returns) {
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
  const eventHandlers = new Map<string, ConduitSocketEvent>();
  const events = JSON.parse(socket.events);
  for (const event in events) {
    const handler = (req: ConduitSocketParameters) => {
      const request = {
        event: req.event,
        socketId: req.socketId,
        params: req.params ? JSON.stringify(req.params) : null,
        context: req.context ? JSON.stringify(req.context) : null,
        functionName: events[req.event].grpcFunction,
      };

      return new Promise<EventResponse | JoinRoomResponse>((resolve, reject) => {
        client.socketRoute(
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

export function createHandlerForProxy(route: ProxyRouteT, moduleName?: string) {
  if (!route.options.path.startsWith('/')) {
    route.options.path = `/${route.options.path}`;
  }
  if (moduleName && !route.options.path.startsWith(`/${moduleName}/`)) {
    if (route.options.path.startsWith('/proxy')) {
      route.options.path = route.options.path.replace('/proxy', `/proxy/${moduleName}`);
    } else {
      route.options.path = `/${moduleName}${route.options.path}`;
    }
  }
  if (!route.options.path.startsWith('/proxy')) {
    route.options.path = `/proxy${route.options.path}`;
  }
  const routeInput = { options: route.options, proxy: route.proxy };
  return new ProxyRoute(routeInput);
}
