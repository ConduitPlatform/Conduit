import {Schema} from "mongoose";
import {ConduitSchema} from "@conduit/sdk";
import * as _ from "lodash";

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {

    let copy = _.cloneDeep(jsonSchema)
    let actual: any = copy.modelSchema;

    // converts relations to mongoose relations
    for (const key in actual as any) {
        if (!actual.hasOwnProperty(key)) continue;
        if (key === '_id') {
            delete actual[key];
            continue;
        }
        if (actual[key].type && actual[key].type === 'Relation') {
            actual[key].type = Schema.Types.ObjectId;
            actual[key].ref = actual[key].model;
            delete actual[key].model;
        }

        if (actual[key].type && actual[key].type === 'JSON') {
            actual[key].type = Schema.Types.Mixed;
        }
    }
    // just to be sure
    // jsonSchema.modelSchema = actual;
    return copy;
}
