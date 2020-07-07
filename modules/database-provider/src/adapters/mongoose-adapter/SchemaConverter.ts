import { Schema } from 'mongoose';
import {ConduitSchema} from "@conduit/sdk";
import * as _ from "lodash";
import { isNil, isObject, isArray } from "lodash";
const deepdash = require('deepdash/standalone');

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {

    let copy = _.cloneDeep(jsonSchema);
    let actual: any = copy.modelSchema;

    if (actual.hasOwnProperty('_id')) {
        delete actual['_id'];
    }
    deepdash.eachDeep(actual, convert);

    // just to be sure
    // jsonSchema.modelSchema = actual;
    return copy;
}

function convert(value: any, key: any, parentValue: any, context: any) {

    if (!parentValue?.hasOwnProperty(key)) {
        return true;
    }

    if (isObject(parentValue[key]?.type) && key !=='database' && key !== 'variables') {
        if (isArray(parentValue[key].type)) {
            const typeSchema = new ConduitSchema(`${key}_type`, parentValue[key].type, {_id: false, timestamps: false});
            parentValue[key] = schemaConverter(typeSchema).modelSchema;
        } else {
            const typeSchema = new ConduitSchema(`${key}_type`, parentValue[key].type, {_id: false, timestamps: false});
            parentValue[key] = schemaConverter(typeSchema).modelSchema;
        }
        return true;
    }

    if (parentValue[key]?.type === 'Relation') {
        const current = parentValue[key];
        current.type = Schema.Types.ObjectId;
        current.ref = parentValue[key].model
        delete current.model;
    }

    if (parentValue[key]?.type === 'JSON') {
        parentValue[key].type = Schema.Types.Mixed;
    }

    if (!isNil(parentValue[key]) && parentValue[key] === 'JSON') {
        parentValue[key] = Schema.Types.Mixed;
    }

    if (parentValue[key]?.systemRequired) {
        delete parentValue[key].systemRequired;
    }
}
