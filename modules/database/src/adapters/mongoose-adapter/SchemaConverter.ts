import { Schema } from 'mongoose';
import {
  ConduitModelField,
  ConduitSchema,
  MongoIndexType,
  SchemaFieldIndex,
} from '@conduitplatform/grpc-sdk';
import { isNil, isObject, cloneDeep, isArray } from 'lodash';
import { checkIfMongoOptions } from './utils';
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
  copy = convertSchemaFieldIndexes(copy);
  deepdash.eachDeep(copy.fields, convert);
  if (copy.modelOptions.indexes) {
    copy = convertModelOptionsIndexes(copy);
  }
  iterDeep(copy.fields);
  return copy;
}

function iterDeep(schema: any) {
  for (const key of Object.keys(schema)) {
    if (isObject(schema[key]) && !isArray(schema[key])) {
      schema[key] = extractObjectType(schema[key]);
      if (schema[key] && !schema[key].hasOwnProperty('type')) {
        iterDeep(schema[key]);
      }
    }
  }
}

function extractObjectType(objectField: any) {
  const res: {
    type?: any;
    default?: any;
    primaryKey?: boolean;
    unique?: boolean;
    required?: boolean;
  } = { ...objectField };
  if (objectField.hasOwnProperty('primaryKey') && objectField.primaryKey) {
    res.primaryKey = objectField.primaryKey ?? false;
    res.unique = true;
    res.required = true;
  } else if (objectField.hasOwnProperty('unique') && objectField.unique) {
    res.unique = objectField.unique ?? false;
    res.required = true;
  } else if (objectField.hasOwnProperty('required') && objectField.required) {
    res.required = objectField.required ?? false;
  }
  return res;
}

function convert(value: any, key: any, parentValue: any) {
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

function convertSchemaFieldIndexes(copy: ConduitSchema) {
  for (const field of Object.entries(copy.fields)) {
    const index = (field[1] as ConduitModelField).index;
    if (!index) continue;
    const type = index.type;
    const options = index.options;
    if (type && !Object.values(MongoIndexType).includes(type)) {
      throw new Error('Incorrect index type for MongoDB');
    }
    if (options) {
      if (!checkIfMongoOptions(options)) {
        throw new Error('Incorrect index options for MongoDB');
      }
      for (const [option, optionValue] of Object.entries(options)) {
        index[option as keyof SchemaFieldIndex] = optionValue;
      }
      delete index.options;
    }
  }
  return copy;
}

function convertModelOptionsIndexes(copy: ConduitSchema) {
  for (const index of copy.modelOptions.indexes!) {
    // compound indexes are maintained in modelOptions in order to be created after schema creation
    // single field index => add it to specified schema field
    if (index.fields.length !== 1) continue;
    const modelField = copy.fields[index.fields[0]] as ConduitModelField;
    if (!modelField) {
      throw new Error(`Field ${modelField} in index definition doesn't exist`);
    }
    if (index.types) {
      if (
        !isArray(index.types) ||
        !Object.values(MongoIndexType).includes(index.types[0]) ||
        index.fields.length !== index.types.length
      ) {
        throw new Error('Invalid index type for MongoDB');
      }
      const type = index.types[0] as MongoIndexType;
      modelField.index = {
        type: type,
      };
    }
    if (index.options) {
      if (!checkIfMongoOptions(index.options)) {
        throw new Error('Incorrect index options for MongoDB');
      }
      for (const [option, optionValue] of Object.entries(index.options)) {
        modelField.index![option as keyof SchemaFieldIndex] = optionValue;
      }
    }
    copy.modelOptions.indexes!.splice(copy.modelOptions.indexes!.indexOf(index), 1);
  }
  return copy;
}
