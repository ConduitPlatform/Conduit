import { RoutingManager } from './RoutingManager';
import {
  ProxyMiddlewareOptions,
  ProxyRouteActions,
  ProxyRouteOptions,
} from './interfaces';

export class ProxyRouteBuilder {
  private _options: ProxyRouteOptions = { path: '' };
  private _proxy: ProxyMiddlewareOptions = { target: '' };

  constructor(private readonly manager?: RoutingManager) {}

  method(action: ProxyRouteActions): ProxyRouteBuilder {
    this._options.action = action;
    return this;
  }

  path(path: string): ProxyRouteBuilder {
    this._options.path = path;
    return this;
  }

  target(target: string): ProxyRouteBuilder {
    this._proxy.target = target;
    return this;
  }

  options(options: ProxyRouteOptions): ProxyRouteBuilder {
    this._options = options;
    return this;
  }

  proxy(proxy: ProxyMiddlewareOptions): ProxyRouteBuilder {
    this._proxy = proxy;
    return this;
  }

  middleware(middleware: string | string[], allowDuplicates = false): ProxyRouteBuilder {
    if (!Array.isArray(middleware)) {
      middleware = [middleware];
    }
    if (this._options.middlewares) {
      if (allowDuplicates) {
        this._options.middlewares = this._options.middlewares.concat(middleware);
      } else {
        this._options.middlewares = this._options.middlewares.concat(
          middleware.filter(mid => this._options.middlewares?.indexOf(mid) === -1),
        );
      }
    } else {
      this._options.middlewares = middleware;
    }
    return this;
  }

  add() {
    if (!this.manager) throw new Error('Builder not setup with manager');
    if (!this._options.path) throw new Error('Cannot build route without path');
    if (!this._proxy.target) throw new Error('Cannot build route without target');
    const input = {
      options: this._options,
      proxy: this._proxy,
    };

    this.manager.proxyRoute(input);
  }

  build() {
    if (!this.manager) throw new Error('Builder not setup with manager');
    if (!this._options.path) throw new Error('Cannot build route without path');
    if (!this._proxy.target) throw new Error('Cannot build route without target');
    if (!this._options.action) throw new Error('Cannot build route without action');
    return {
      input: {
        options: this._options,
        proxy: this._proxy,
      },
    };
  }
}
