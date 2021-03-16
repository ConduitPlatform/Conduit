import { ConduitMiddlewareOptions } from '../interfaces';

export class ConduitMiddleware {
  private _input: ConduitMiddlewareOptions;
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
