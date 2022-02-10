import {
  ConduitMiddlewareOptions,
  ConduitModel,
  ConduitRouteActions,
  ConduitRouteOption,
  ConduitRouteOptions,
} from '../interfaces';
import { ParsedRouterRequest, UnparsedRouterResponse } from '../types';
import { ConduitRouteReturnDefinition, GrpcServer } from '../classes';
import { Router } from '../modules';
import { RequestHandlers } from '../helpers';

class RouteBuilder {
  private readonly _options!: ConduitRouteOptions;
  private _returns!: ConduitRouteReturnDefinition;
  private _handler!: RequestHandlers;

  constructor(private readonly manager: RoutingManager) {
    this._options = {} as any;
  }

  method(action: ConduitRouteActions): RouteBuilder {
    this._options.action = action;
    return this;
  }

  name(name: string): RouteBuilder {
    this._options.name = name;
    return this;
  }

  description(description: string): RouteBuilder {
    this._options.description = description;
    return this;
  }

  cacheControl(cache: string): RouteBuilder {
    this._options.cacheControl = cache;
    return this;
  }

  middleware(middleware: string | string[], allowDuplicates = false): RouteBuilder {
    if (!Array.isArray(middleware)) {
      middleware = [middleware];
    }
    if (this._options.middlewares?.length !== 0) {
      if (allowDuplicates) {
        this._options.middlewares?.concat(middleware);
      } else {
        // add to existing middlewares and filter out potential duplicates
        this._options.middlewares?.concat(middleware.filter(mid => this._options.middlewares?.indexOf(mid) === -1));
      }
    } else {
      this._options.middlewares = middleware;
    }
    return this;
  }

  path(path: string): RouteBuilder {
    this._options.path = path;
    return this;
  }

  queryParams(params: ConduitRouteOption | ConduitModel): RouteBuilder {
    this._options.queryParams = params;
    return this;
  }

  urlParams(params: ConduitRouteOption | ConduitModel): RouteBuilder {
    this._options.urlParams = params;
    return this;
  }

  bodyParams(params: ConduitRouteOption | ConduitModel): RouteBuilder {
    this._options.bodyParams = params;
    return this;
  }

  return(name: string, fields: ConduitModel | string): RouteBuilder {
    this._returns = new ConduitRouteReturnDefinition(name, fields);
    return this;
  }

  handler(fn: RequestHandlers): RouteBuilder {
    this._handler = fn;
    return this;
  }


  build() {
    if (!this._options) throw new Error('Cannot build route without options');
    if (!this._options.action) throw new Error('Cannot build route without action');
    if (!this._options.path) throw new Error('Cannot build route without action');
    if (!this._returns) throw new Error('Cannot build route without return');
    if (!this._handler) throw new Error('Cannot build route without handler');
    this.manager.route(this._options, this._returns, this._handler);
  }


}

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

  get get(): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.GET);
  }

  get post(): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.POST);
  }

  get delete(): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.DELETE);
  }

  get update(): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.UPDATE);
  }

  get patch(): RouteBuilder {
    return new RouteBuilder(this).method(ConduitRouteActions.PATCH);
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

  private extractNameFromPath(path: string) {
    path = path.replace(/[-:]/g, '/');
    return path.split('/').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
  }


}
