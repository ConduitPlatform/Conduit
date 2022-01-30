import { Schema } from 'mongoose';
import { ConduitSchema } from '@conduitplatform/conduit-grpc-sdk';
import { isNil, isObject, cloneDeep} from 'lodash';
const deepdash = require('deepdash/standalone');

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {
  let copy = cloneDeep(jsonSchema);

  if (copy.modelSchema.hasOwnProperty('_id')) {
    delete copy.modelSchema['_id'];
  }

  deepdash.eachDeep(copy.modelSchema, convert);

  return copy;
}

function convert(value: any, key: any, parentValue: any, context: any) {
  if (!parentValue?.hasOwnProperty(key)) {
    return true;
  }

  if (isObject(parentValue[key]?.type) && key !== 'database' && key !== 'variables') {
    const typeSchema = new ConduitSchema(`${key}_type`, parentValue[key].type, {
      _id: false,
      timestamps: false,
    });
    parentValue[key] = schemaConverter(typeSchema).modelSchema;
    return true;
  }

  if (parentValue[key]?.type === 'Relation') {
    const current = parentValue[key];
    current.type = Schema.Types.ObjectId;
    current.ref = parentValue[key].model;
    delete current.model;
  }

  if (parentValue[key]?.type === 'JSON') {
    parentValue[key].type = Schema.Types.Mixed;
  }

  if (!isNil(parentValue[key]) && parentValue[key] === 'JSON') {
    parentValue[key] = Schema.Types.Mixed;
  }

  if (parentValue[key]?.systemRequired) { // Remove this after custom modules are updated
    delete parentValue[key].systemRequired;
  }
}
