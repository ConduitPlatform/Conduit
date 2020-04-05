import {SchemaInterface} from "../../interfaces/SchemaInterface";
import {Schema} from "mongoose";


/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: SchemaInterface) {

    let actual = jsonSchema.modelSchema;

    // converts relations to mongoose relations
    for (const key in actual) {
        if (actual[key].type === 'Relation') {
            actual[key].type = Schema.Types.ObjectId;
            actual[key].ref = actual[key].model;
            delete actual[key].model;
        }

        if (actual[key].type === 'JSON') {
            actual[key].type = Schema.Types.Mixed;
        }
    }
    // just to be sure
    jsonSchema.modelSchema = actual;
    return jsonSchema;
}
