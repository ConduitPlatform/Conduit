import { RoutingManager } from './RoutingManager';
import { ConduitProxyOptions } from './interfaces';

export class ProxyRouteBuilder {
  private readonly _options!: ConduitProxyOptions;

  constructor(private readonly manager?: RoutingManager) {
    this._options = {} as any;
  }

  path(path: string): ProxyRouteBuilder {
    this._options.path = path;
    return this;
  }

  target(target: string): ProxyRouteBuilder {
    this._options.target = target;
    return this;
  }

  middleware(middleware: string | string[], allowDuplicates = false): ProxyRouteBuilder {
    if (!Array.isArray(middleware)) {
      middleware = [middleware];
    }
    if (
      this._options.middlewares !== undefined &&
      this._options.middlewares?.length !== 0
    ) {
      if (allowDuplicates) {
        this._options.middlewares?.concat(middleware);
      } else {
        // add to existing middlewares and filter out potential duplicates
        this._options.middlewares?.concat(
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
    if (!this._options) throw new Error('Cannot build route without options');
    if (!this._options.path) throw new Error('Cannot build route without path');
    if (!this._options.target) throw new Error('Cannot build route without target');
    this.manager.proxy(this._options.path, this._options.target);
  }

  build() {
    if (!this.manager) throw new Error('Builder not setup with manager');
    if (!this._options) throw new Error('Cannot build route without options');

    if (!this._options.path) throw new Error('Cannot build route without path');
    if (!this._options.target) throw new Error('Cannot build route without target');
    return {
      path: this._options.path,
      target: this._options.target,
    };
  }
}
