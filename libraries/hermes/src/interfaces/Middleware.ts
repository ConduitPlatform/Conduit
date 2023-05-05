import {
  ConduitRouteActions,
  ConduitRouteParameters,
  PostRequestMiddlewaresParameters,
} from '@conduitplatform/grpc-sdk';

// having all these as optional parameters is only here,
// to allow us not to change the route creation typing drastically
export interface ConduitMiddlewareOptions {
  action?: ConduitRouteActions;
  path?: string;
  name?: string;
  description?: string;
}

export class ConduitMiddleware {
  private readonly _input: ConduitMiddlewareOptions;
  private readonly _middlewareName: string;
  private readonly _handler: (
    request: ConduitRouteParameters | PostRequestMiddlewaresParameters,
  ) => Promise<any>;

  constructor(
    input: ConduitMiddlewareOptions,
    middlewareName: string,
    handler: (
      request: ConduitRouteParameters | PostRequestMiddlewaresParameters,
    ) => Promise<any>,
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

  executeRequest(request: ConduitRouteParameters | PostRequestMiddlewaresParameters) {
    return this._handler(request);
  }
}
