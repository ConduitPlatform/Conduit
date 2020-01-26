import {SchemaInterface} from "../../interfaces/SchemaInterface";
import {Schema} from "mongoose";


/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: SchemaInterface) {

    let actual = jsonSchema.schema;

    // converts relations to mongoose relations
    for (const key in actual) {
        if (actual[key].type === 'Relation') {
            actual[key].type = Schema.Types.ObjectId;
            actual[key].ref = actual[key].model;
            delete actual[key].model;
        }
    }
    // just to be sure
    jsonSchema.schema = actual;
    return jsonSchema;
}
