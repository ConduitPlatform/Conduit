import { RoutingManager } from './RoutingManager';
import { ConduitProxyOptions } from './interfaces';

export class ProxyRouteBuilder {
  private _options: ConduitProxyOptions;

  constructor(private readonly manager?: RoutingManager, options?: ConduitProxyOptions) {
    this._options = options || { path: '', target: '' };
  }

  path(path: string): ProxyRouteBuilder {
    this._options.path = path;
    return this;
  }

  target(target: string): ProxyRouteBuilder {
    this._options.target = target;
    return this;
  }

  options(options: ConduitProxyOptions): ProxyRouteBuilder {
    this._options = options;
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
    if (!this._options.target) throw new Error('Cannot build route without target');
    this.manager.proxyRoute(this._options);
  }

  build() {
    if (!this.manager) throw new Error('Builder not setup with manager');
    if (!this._options.path) throw new Error('Cannot build route without path');
    if (!this._options.target) throw new Error('Cannot build route without target');
    return {
      input: this._options,
    };
  }
}
