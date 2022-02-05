import { ConduitMiddlewareOptions, ConduitRouteOptions } from '../interfaces';
import { ParsedRouterRequest, UnparsedRouterResponse } from '../types';
import { ConduitRouteReturnDefinition, GrpcServer } from '../classes';
import { Router } from '../modules';


export class RoutingManager {

  private _moduleRoutes: {
    [key: string]: {
      options: ConduitRouteOptions,
      returns: { name: string; fields: string; },
      grpcFunctionName: string,
      grpcFunction: (request: ParsedRouterRequest) => Promise<UnparsedRouterResponse>;
    }
  } = {};
  private _routeHandlers: {
    [key: string]: (request: ParsedRouterRequest) => Promise<UnparsedRouterResponse>
  } = {};

  constructor(private readonly _router: Router, private readonly _server: GrpcServer) {
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
      routeObject.options[option] = JSON.stringify(routeObject.options[option]);
    }
    this._moduleRoutes[routeObject.grpcFunction] = routeObject;
    this._routeHandlers[routeObject.grpcFunction] = handler;
  }

  route(input: ConduitRouteOptions, type: ConduitRouteReturnDefinition, handler: (request: ParsedRouterRequest) => Promise<UnparsedRouterResponse>) {
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

  async registerRoutes() {
    return this._router.registerRouterAsync(this._server, Object.values(this._moduleRoutes), this._routeHandlers);
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

  private extractNameFromPath(path:string){
    path = path.replace(/[-:]/g,'/');
    return path.split('/').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
  }


}
