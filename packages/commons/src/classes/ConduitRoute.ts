import { ConduitRouteReturnDefinition } from './ConduitRouteReturn';
import {
  ConduitModel,
  ConduitRouteActions,
  ConduitRouteOptions,
  ConduitRouteParameters,
  ConduitStreamRouteOptions,
  ConduitStreamRouteParameters,
  StreamIterable,
} from '@conduitplatform/grpc-sdk';
import { buildStreamFileIterable } from '../utilities';

export class ConduitRoute {
  private _returnType: ConduitRouteReturnDefinition;
  private readonly _input: ConduitRouteOptions | ConduitStreamRouteOptions;
  // private readonly _handler: (request: ConduitRouteParameters | ConduitStreamRouteParameters) => Promise<any>;
  private readonly _handler: (request: ConduitRouteParameters | StreamIterable) => Promise<any>;

  constructor(
    input: ConduitRouteOptions | ConduitStreamRouteOptions,
    type: ConduitRouteReturnDefinition,
    // handler: (request: ConduitRouteParameters | ConduitStreamRouteParameters) => Promise<any>
    handler: (request: ConduitRouteParameters | StreamIterable) => Promise<any>
  ) {
    this._input = input;
    this._returnType = type;
    this._handler = handler;
  }

  get returnTypeName(): string {
    return this._returnType.name;
  }

  get input(): ConduitRouteOptions | ConduitStreamRouteOptions {
    return this._input;
  }

  get returnTypeFields(): ConduitModel | string {
    return this._returnType.fields;
  }

  executeRequest(request: ConduitRouteParameters): Promise<any> {
    return this._handler(request);
  }

  executeStreamRequest(request: ConduitStreamRouteParameters, action: ConduitRouteActions): Promise<any> {
    // Note: action arg is here to infer streamable action type and pick right async iterable builder
    if (action === ConduitRouteActions.FILE_UPLOAD) {
      const streamIterable = buildStreamFileIterable(request);
      return this._handler(streamIterable);
    } else {
      throw new Error('Unsupported stream operation');
    }
  }
}
