import {
  ConduitModel,
  ConduitQueryParams,
  ConduitReturn,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  ConduitUrlParams,
} from '@conduitplatform/grpc-sdk';
import { RoutingManager } from './RoutingManager.js';
import { RequestHandlers } from './wrapRouterFunctions.js';

export class RouteBuilder {
  private readonly _options!: ConduitRouteOptions;
  private _returns!: ConduitRouteReturnDefinition;
  private _handler!: RequestHandlers;

  constructor(private readonly manager?: RoutingManager) {
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
    if (
      this._options.middlewares !== undefined &&
      this._options.middlewares?.length !== 0
    ) {
      if (allowDuplicates) {
        this._options.middlewares = this._options.middlewares?.concat(middleware);
      } else {
        // add to existing middlewares and filter out potential duplicates
        this._options.middlewares = this._options.middlewares?.concat(
          middleware.filter(mid => this._options.middlewares?.indexOf(mid) === -1),
        );
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

  queryParams(params: ConduitQueryParams): RouteBuilder {
    this._options.queryParams = params;
    return this;
  }

  urlParams(params: ConduitUrlParams): RouteBuilder {
    this._options.urlParams = params;
    return this;
  }

  bodyParams(params: ConduitModel): RouteBuilder {
    this._options.bodyParams = params;
    return this;
  }

  return(name: string, fields: ConduitReturn): RouteBuilder {
    this._returns = new ConduitRouteReturnDefinition(name, fields);
    return this;
  }

  handler(fn: RequestHandlers): RouteBuilder {
    this._handler = fn;
    return this;
  }

  add() {
    if (!this.manager) throw new Error('Builder not setup with manager');
    if (!this._options) throw new Error('Cannot build route without options');
    if (!this._options.action) throw new Error('Cannot build route without action');
    if (!this._options.path) throw new Error('Cannot build route without action');
    if (!this._returns) throw new Error('Cannot build route without return');
    if (!this._handler) throw new Error('Cannot build route without handler');
    this.manager.route(this._options, this._returns, this._handler);
  }

  build(): ConduitRoute {
    if (!this._options) throw new Error('Cannot build route without options');
    if (!this._options.action) throw new Error('Cannot build route without action');
    if (!this._options.path) throw new Error('Cannot build route without action');
    if (!this._returns) throw new Error('Cannot build route without return');
    if (!this._handler) throw new Error('Cannot build route without handler');
    return {
      input: this._options,
      returnType: this._returns,
      handler: this._handler,
    };
  }
}
