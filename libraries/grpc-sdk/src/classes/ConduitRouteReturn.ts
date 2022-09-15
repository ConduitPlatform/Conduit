import { ConduitModel } from '../interfaces';

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
export class ConduitRouteReturnDefinition {
  private _name: string;
  private _fields: ConduitModel | string; // object definition or well-known* type as a string

  // Well-known types include:
  // - TYPE enum values
  // - explicitly registered route return type names
  // - registered database schema types

  constructor(name: string, fields?: ConduitModel | string) {
    this._name = name;
    // TODO:
    // Defaulting to named schema types should throw on "reserved" base types (throw on Hermes-side also).
    // eg TYPE enum values ('String', 'Relation' etc), reserved GraphQL types etc
    // Database should also prohibit these names from being used as schema names
    this._fields = fields ?? name;
  }

  get name(): string {
    return this._name;
  }

  get fields(): ConduitModel | string {
    return this._fields;
  }
}
