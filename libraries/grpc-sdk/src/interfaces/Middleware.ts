import { ConduitRouteActions } from ".";

// having all these as optional parameters is only here,
// to allow us not to change the route creation typing drasticaly
export interface ConduitMiddlewareOptions {
    action?: ConduitRouteActions
    path?: string;
    name?: string;
    description?: string;
}

export class ConduitMiddleware {
    private _input: ConduitMiddlewareOptions
    private _handler: string;

    constructor(input: ConduitMiddlewareOptions, handler: string) {
        this._input = input;
        this._handler = handler;
    }

    get input(): ConduitMiddlewareOptions {
        return this._input;
    }

    get handler(): string {
        return this._handler;
    }
}
