import { Schema } from 'mongoose';
import { ConduitModelField, ConduitSchema } from '@conduitplatform/grpc-sdk';
import { isNil, isObject, cloneDeep } from 'lodash';
const deepdash = require('deepdash/standalone');

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {
  let copy = cloneDeep(jsonSchema);
  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }
  deepdash.eachDeep(copy.fields, convertSchemaFieldIndexes);
  deepdash.eachDeep(copy.fields, convert);
  if (copy.modelOptions.indexes) {
    copy = convertModelOptionsIndexes(copy);
  }
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
    parentValue[key] = schemaConverter(typeSchema).fields;
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

  if (parentValue[key]?.systemRequired) {
    // Remove this after custom modules are updated
    delete parentValue[key].systemRequired;
  }
}

function convertSchemaFieldIndexes(value: any, key: any) {
  if (key == 'index') {
    for (const [option, optionValue] of Object.entries(value.options)) {
      value[option] = optionValue;
    }
    delete value.options;
    return false;
  }
}

function convertModelOptionsIndexes(copy: ConduitSchema) {
  for (const index of copy.modelOptions.indexes) {
    if (index.fields.length === 1) {
      const modelField = copy.fields[index.fields[0]] as ConduitModelField;
      if (modelField.index) {
        throw new Error(`Field ${modelField} already has an index defined`);
      }
      modelField.index = {
        type: index.type,
      };
      for (const [option, optionValue] of Object.entries(index.options)) {
        modelField.index[option] = optionValue;
      }
    } else {
      throw new Error("You can't create compound indexes at mongoose path level");
    }
  }
  delete copy.modelOptions.indexes;
  return copy;
}
