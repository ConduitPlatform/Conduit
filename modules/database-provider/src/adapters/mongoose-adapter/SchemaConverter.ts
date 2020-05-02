import { Schema } from 'mongoose';
import { ConduitSchema } from '@conduit/sdk';
import * as _ from 'lodash';

const deepdash = require('deepdash/standalone')

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {

    let copy = _.cloneDeep(jsonSchema);
    let actual: any = copy.modelSchema;

    // converts relations to mongoose relations
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

    if (parentValue[key]?.type === 'Relation') {
        const current = parentValue[key];
        current.type = Schema.Types.ObjectId;
        current.ref = parentValue[key].model
        delete current.model;
    }

    if (parentValue[key]?.type === 'JSON') {
        parentValue[key].type = Schema.Types.Mixed;
    }
}
