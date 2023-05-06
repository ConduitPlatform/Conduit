/**
 * Supports:
 * {
 *     name: 'String',
 *     age: 'Number
 *     ....
 * }
 *
 * or
 *
 * {
 *     name: {
 *         type: 'String',
 *         required: true
 *     },
 *     age: 'Number'
 * }
 *
 * or
 *
 * {
 *     user: {
 *         username: 'String',
 *         age: {
 *             type: 'Number',
 *             required: true
 *         }
 *     }
 * }
 *
 * or
 *
 * {
 *     user:{
 *         friends: ['String'],
 *         post: [{type: 'String', required:trues}]
 *     }
 * }
 *
 */
import { ConduitModel, ConduitRouteOption } from '@conduitplatform/grpc-sdk';

export class ConduitRouteReturnDefinition {
  private _name: string;
  private _fields: ConduitRouteOption | ConduitModel | string;

  constructor(name: string, fields: ConduitRouteOption | ConduitModel | string) {
    this._name = name;
    this._fields = fields;
  }

  get name(): string {
    return this._name;
  }

  get fields(): ConduitRouteOption | ConduitModel | string {
    return this._fields;
  }
}
