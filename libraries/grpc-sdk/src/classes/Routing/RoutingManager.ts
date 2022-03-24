import {
  ConduitMiddlewareOptions,
  ConduitRouteActions,
  ConduitRouteOptions,
  ConduitSocketEventHandler,
  ConduitSocketOptions,
  EventsProtoDescription,
} from '../../interfaces';
import { ParsedRouterRequest, UnparsedRouterResponse } from '../../types';
import { ConduitRouteReturnDefinition, GrpcServer } from '../index';
import { Router } from '../../modules';
import { RequestHandlers } from '../../helpers';
import { constructProtoFile, wrapFunctionsAsync } from '../../helpers/RoutingUtilities';
import { RouteBuilder } from './RouteBuilder';


export class RoutingManager {

  private _moduleRoutes: {
    [key: string]: {
      options: ConduitRouteOptions,
      returns: { name: string; fields: string; },
      grpcFunctionName: string,
      grpcFunction: RequestHandlers;
    }
  } = {};
  private _routeHandlers: {
    [key: string]: RequestHandlers
  } = {};

  constructor(private readonly _router: Router, private readonly _server: GrpcServer) {
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

  middleware(input: ConduitMiddlewareOptions, handler: (request: ParsedRouterRequest) => Promise<UnparsedRouterResponse>) {
    let routeObject: any = {
      options: input,
      grpcFunction: input.name,
    };
    if (!routeObject.options.middlewares) {
      routeObject.options.middlewares = [];
    }
    for (let option in routeObject.options) {
      if (!routeObject.options.hasOwnProperty(option)) continue;
      if (option === 'middlewares') continue;
      routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  route(input: ConduitRouteOptions, type: ConduitRouteReturnDefinition, handler: RequestHandlers) {
    let routeObject: any = {
      options: input,
      returns: {
        name: type.name,
        fields: JSON.stringify(type.fields),
      },
      grpcFunction: this.generateGrpcName(input),
    };

    if (!routeObject.options.middlewares) {
      routeObject.options.middlewares = [];
    }
    for (let option in routeObject.options) {
      if (!routeObject.options.hasOwnProperty(option)) continue;
      if (option === 'middlewares') continue;
      routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  socket(input: ConduitSocketOptions, events: Record<string, ConduitSocketEventHandler>) {
    let routeObject: any = {
      options: input,
      events: '',

    };
    let eventsObj: EventsProtoDescription = {};
    if (!routeObject.options.middlewares) {
      routeObject.options.middlewares = [];
    }
    for (let option in routeObject.options) {
      if (!routeObject.options.hasOwnProperty(option)) continue;
      if (option === 'middlewares') continue;
      if (option === 'path') continue;
      routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }
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
    let modifiedFunctions: { [name: string]: (call: any, callback: any) => void } = wrapFunctionsAsync(this._routeHandlers);
    let protoDescriptions = constructProtoFile(this._router.moduleName, Object.values(this._moduleRoutes));
    await this._server.addService(
      protoDescriptions.path, protoDescriptions.name + '.router.Router',
      modifiedFunctions,
    );
    return this._router.register(Object.values(this._moduleRoutes), protoDescriptions.file);
  }

  private generateGrpcName(options: ConduitRouteOptions) {
    if (options.name) {
      return options.name.charAt(0).toUpperCase() + options.name.slice(1);
    } else {
      let name = options.action.charAt(0) + options.action.slice(1).toLowerCase() + this.extractNameFromPath(options.path)
      ;
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  private extractNameFromPath(path: string) {
    path = path.replace(/[-:]/g, '/');
    return path.split('/').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
  }


}
