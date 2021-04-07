import { ConduitRouteReturnDefinition } from './Route';
import { ConduitModel } from '@quintessential-sft/conduit-grpc-sdk';

export interface ConduitSocketParameters {
  event: string;
  params?: { [field: string ]: any };
}

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
  params?: ConduitModel;
  // middlewares?: string[]; // TODO https://socket.io/docs/v4/middlewares/
}

export type ConduitSocketEventHandlers = { [eventName: string]: (request: ConduitSocketParameters) => Promise<any> };


export class ConduitSocket {
  private readonly _input: ConduitSocketOptions
  private readonly _returnType: ConduitRouteReturnDefinition;
  private readonly _eventHandlers: ConduitSocketEventHandlers;

  constructor(
    input: ConduitSocketOptions,
    type: ConduitRouteReturnDefinition,
    eventHandlers: ConduitSocketEventHandlers
  ) {
    this._input = input;
    this._returnType = type;
    this._eventHandlers = eventHandlers;
  }

  get returnTypeName(): string {
    return this._returnType.name;
  }

  get input(): ConduitSocketOptions {
    return this._input;
  }

  get returnTypeFields(): ConduitModel | string {
    return this._returnType.fields;
  }

  executeRequest(request: ConduitSocketParameters): Promise<any> {
    if (this._eventHandlers[request.event]) {
      return this._eventHandlers[request.event](request);
    } else if (this._eventHandlers['any']) {
      return this._eventHandlers['any'](request);
    }
    return Promise.reject<string>('no such event registered');
  }
}
