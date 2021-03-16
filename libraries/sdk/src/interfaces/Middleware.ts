import { ConduitRouteActions, ConduitRouteParameters } from '.';

// having all these as optional parameters is only here,
// to allow us not to change the route creation typing drasticaly
export interface ConduitMiddlewareOptions {
  action?: ConduitRouteActions;
  path?: string;
  name?: string;
  description?: string;
}

export class ConduitMiddleware {
  private _input: ConduitMiddlewareOptions;
  private _middlewareName: string;
  private _handler: (request: ConduitRouteParameters) => Promise<any>;

  constructor(
    input: ConduitMiddlewareOptions,
    middlewareName: string,
    handler: (request: ConduitRouteParameters) => Promise<any>
  ) {
    this._input = input;
    this._middlewareName = middlewareName;
    this._handler = handler;
  }

  get input(): ConduitMiddlewareOptions {
    return this._input;
  }

  get name(): string {
    return this._middlewareName;
  }

  executeRequest(request: ConduitRouteParameters): Promise<any> {
    return this._handler(request);
  }
}
