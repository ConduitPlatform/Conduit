import { Schema } from 'mongoose';
import {
  ConduitModelField,
  ConduitSchema,
  MongoIndexType,
  SchemaFieldIndex,
} from '@conduitplatform/grpc-sdk';
import { cloneDeep, isArray, isNil, isObject } from 'lodash';
import { checkIfMongoOptions } from './utils';
import { ConduitDatabaseSchema } from '../../interfaces';

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
  if (!objectField.hasOwnProperty('type')) return objectField;
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
    parentValue[key] = schemaConverter(typeSchema as ConduitDatabaseSchema).fields;
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
    const { type, options } = index;
    if (type && !(type in MongoIndexType)) {
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
    // Compound indexes are maintained in modelOptions in order to be created after schema creation
    // Single field index => add it to specified schema field
    const { name, fields, types, options } = index;
    if (fields.length === 0) {
      throw new Error('Undefined fields for index creation');
    }
    if (fields.some(field => !Object.keys(copy.fields).includes(field))) {
      throw new Error(`Invalid fields for index creation`);
    }
    if (fields.length !== 1) continue;
    const modelField = copy.fields[index.fields[0]] as ConduitModelField;
    if (types) {
      if (
        !isArray(types) ||
        !(types[0] in MongoIndexType) ||
        fields.length !== types.length
      ) {
        throw new Error('Invalid index type for MongoDB');
      }
      modelField.index = {
        name,
        type: types[0] as MongoIndexType,
      };
    }
    if (options) {
      if (!checkIfMongoOptions(options)) {
        throw new Error('Incorrect index options for MongoDB');
      }
      for (const [option, optionValue] of Object.entries(options)) {
        modelField.index![option as keyof SchemaFieldIndex] = optionValue;
      }
    }
    copy.modelOptions.indexes!.splice(copy.modelOptions.indexes!.indexOf(index), 1);
  }
  return copy;
}
