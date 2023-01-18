import { GrpcServer } from '../index';
import { Admin, Router } from '../modules';
import { RouteBuilder } from './RouteBuilder';
import { RequestHandlers } from './wrapRouterFunctions';
import { ConduitRouteReturnDefinition } from './ConduitRouteReturn';
import { wrapFunctionsAsync } from './RoutingUtilities';
import { RegisterConduitRouteRequest_PathDefinition } from '../protoUtils/router';
import {
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteObject,
  ConduitRouteOptions,
  ConduitSocketEventHandler,
  ConduitSocketOptions,
  ConduitMiddlewareOptions,
  EventsProtoDescription,
  SocketProtoDescription,
} from './interfaces';
import { RegisterAdminRouteRequest_PathDefinition } from '../protoUtils/core';
import fs from 'fs';
import path from 'path';

export class RoutingManager {
  private _moduleRoutes: {
    [key: string]: ConduitRouteObject | SocketProtoDescription;
  } = {};
  private _routeHandlers: {
    [key: string]: RequestHandlers;
  } = {};
  private readonly isAdmin: boolean = false;

  constructor(
    private readonly _router: Router | Admin,
    private readonly _server: GrpcServer,
  ) {
    if (_router instanceof Admin) {
      this.isAdmin = true;
    }
  }

  get(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.GET).path(path);
  }

  post(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.POST).path(path);
  }

  delete(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.DELETE).path(path);
  }

  update(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.UPDATE).path(path);
  }

  patch(path: string): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.PATCH).path(path);
  }

  clear() {
    this._moduleRoutes = {};
    this._routeHandlers = {};
  }

  middleware(
    input: ConduitMiddlewareOptions,
    handler: (request: ParsedRouterRequest) => Promise<UnparsedRouterResponse>,
  ) {
    const routeObject: ConduitRouteObject = this.parseRouteObject({
      options: input,
      grpcFunction: input.name,
    }) as ConduitRouteObject;
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  route(
    input: ConduitRouteOptions,
    type: ConduitRouteReturnDefinition,
    handler: RequestHandlers,
  ) {
    const routeObject: ConduitRouteObject = this.parseRouteObject({
      options: input,
      returns: {
        name: type.name,
        fields: JSON.stringify(type.fields),
      },
      grpcFunction: this.generateGrpcName(input),
    }) as ConduitRouteObject;
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  socket(input: ConduitSocketOptions, events: Record<string, ConduitSocketEventHandler>) {
    const eventsObj: EventsProtoDescription = {};
    const routeObject: SocketProtoDescription = this.parseRouteObject({
      options: input,
      events: '',
    }) as SocketProtoDescription;
    let primary: string;
    Object.keys(events).forEach((eventName: string) => {
      if (!primary) primary = eventName;
      const event = events[eventName];
      eventsObj[eventName] = {
        grpcFunction: eventName,
        params: JSON.stringify(event.params),
        returns: {
          name: event.returnType?.name ?? '',
          fields: JSON.stringify(event.returnType?.fields),
        },
      };
      this._routeHandlers[eventName] = event.handler;
    });
    routeObject.events = JSON.stringify(eventsObj);

    this._moduleRoutes[primary!] = routeObject;
  }

  async registerRoutes() {
    if (Object.keys(this._routeHandlers).length === 0) return;
    const modifiedFunctions: {
      [name: string]: (call: any, callback: any) => void;
    } = wrapFunctionsAsync(this._routeHandlers, this.isAdmin ? 'admin' : 'client');
    const protoDescriptions = await this._router.generateProtoFile(
      this._router.moduleName,
      Object.values(this._moduleRoutes),
    );
    const protoPath = path.resolve(__dirname, Math.random().toString(36).substring(7));
    fs.writeFileSync(protoPath, protoDescriptions.protoFile);
    await this._server.addService(
      protoPath,
      protoDescriptions.formattedModuleName +
        (this.isAdmin ? '.admin.Admin' : '.router.Router'),
      modifiedFunctions,
    );
    const paths = Object.values(this._moduleRoutes);
    return this._router.register(
      this.isAdmin
        ? (paths as RegisterAdminRouteRequest_PathDefinition[])
        : (paths as RegisterConduitRouteRequest_PathDefinition[]),
      protoDescriptions.protoFile,
    );
  }
  private generateGrpcName(options: ConduitRouteOptions) {
    if (options.name) {
      return options.name.charAt(0).toUpperCase() + options.name.slice(1);
    } else {
      const name =
        options.action.charAt(0) +
        options.action.slice(1).toLowerCase() +
        this.extractNameFromPath(options.path);
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  private extractNameFromPath(path: string) {
    path = path.replace(/[-:]/g, '/');
    return path
      .split('/')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private parseRouteObject(
    routeObject: any,
  ): ConduitRouteObject | SocketProtoDescription {
    if (!routeObject.options.middlewares) {
      routeObject.options.middlewares = [];
    }
    for (const option in routeObject.options) {
      if (!routeObject.options.hasOwnProperty(option)) continue;
      if (option === 'middlewares') continue;
      if (
        typeof routeObject.options[option] === 'string' ||
        routeObject.options[option] instanceof String
      )
        continue;
      routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }
    return routeObject;
  }
}
