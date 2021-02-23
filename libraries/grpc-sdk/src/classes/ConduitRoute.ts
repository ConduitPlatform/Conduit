import { ConduitModel, ConduitRouteOptions } from '../interfaces';
import { ConduitRouteReturnDefinition } from './ConduitRouteReturn';

export class ConduitRoute {
  private _returnType: ConduitRouteReturnDefinition;
  private _input: ConduitRouteOptions;
  private _handler: string;

  constructor(
    input: ConduitRouteOptions,
    type: ConduitRouteReturnDefinition,
    handler: string
  ) {
    this._input = input;
    this._returnType = type;
    this._handler = handler;
  }

  get returnTypeName(): string {
    return this._returnType.name;
  }

  get input(): ConduitRouteOptions {
    return this._input;
  }

  get returnTypeFields(): ConduitModel | string {
    return this._returnType.fields;
  }

  get handler(): string {
    return this._handler;
  }
}
