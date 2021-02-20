import {ConduitModel} from "../interfaces";

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
    private _fields: ConduitModel | string;

    constructor(name: string, fields: ConduitModel | string) {
        this._name = name;
        this._fields = fields;
    }

    get name(): string {
        return this._name;
    }

    get fields(): ConduitModel | string {
        return this._fields;
    }

}
