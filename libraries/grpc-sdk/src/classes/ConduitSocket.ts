import { ConduitRouteReturnDefinition } from './ConduitRouteReturn';
import { ConduitModel } from '../interfaces';
import { ConduitSocketEventHandlers, ConduitSocketOptions } from '../interfaces';

export class ConduitSocket {
  private readonly _input: ConduitSocketOptions;
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

  get input(): ConduitSocketOptions {
    return this._input;
  }

  get returnTypeName(): string {
    return this._returnType.name;
  }

  get returnTypeFields(): ConduitModel | string {
    return this._returnType.fields;
  }

  get eventHandlers(): ConduitSocketEventHandlers {
    return this._eventHandlers;
  }

}
