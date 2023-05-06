import { ConduitRouteReturnDefinition } from './ConduitRouteReturn';
import {
  ConduitModel,
  ConduitRouteOption,
  ConduitRouteOptions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';

export class ConduitRoute {
  private _returnType: ConduitRouteReturnDefinition;
  private _input: ConduitRouteOptions;
  private _handler: (request: ConduitRouteParameters) => Promise<any>;

  constructor(
    input: ConduitRouteOptions,
    type: ConduitRouteReturnDefinition,
    handler: (request: ConduitRouteParameters) => Promise<any>,
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

  get returnTypeFields(): ConduitRouteOption | ConduitModel | string {
    return this._returnType.fields;
  }

  executeRequest(request: ConduitRouteParameters) {
    return this._handler(request);
  }
}
