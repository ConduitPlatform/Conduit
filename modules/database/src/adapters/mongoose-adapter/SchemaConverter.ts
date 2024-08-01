import { Schema } from 'mongoose';
import {
  ConduitGrpcSdk,
  ConduitModelField,
  ConduitSchema,
  ModelOptionsIndex,
  MongoIndexType,
  SchemaFieldIndex,
} from '@conduitplatform/grpc-sdk';
import { cloneDeep, isArray, isNil, isObject } from 'lodash-es';
import { checkIfMongoOptions } from './utils.js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';
import * as deepdash from 'deepdash-es/standalone';

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {
  const copy = cloneDeep(jsonSchema);
  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }
  convertSchemaFieldIndexes(copy);
  deepdash.eachDeep(copy.fields, convert);
  if (copy.modelOptions.indexes) {
    copy.modelOptions.indexes = convertModelOptionsIndexes(copy);
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
  for (const [, fieldObj] of Object.entries(copy.fields)) {
    const index = (fieldObj as ConduitModelField).index;
    if (!index) continue;
    const { type, options } = index;
    if (type && !(type in MongoIndexType)) {
      ConduitGrpcSdk.Logger.warn(
        `Invalid index type for MongoDB found in: ${copy.name}. Index ignored`,
      );
      delete (fieldObj as ConduitModelField).index;
      continue;
    }
    if (options) {
      if (!checkIfMongoOptions(options)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index options for MongoDB found in: ${copy.name}. Index ignored`,
        );
        delete (fieldObj as ConduitModelField).index;
        continue;
      }
      for (const [option, optionValue] of Object.entries(options)) {
        index[option as keyof SchemaFieldIndex] = optionValue;
      }
      delete index.options;
    }
  }
}

function convertModelOptionsIndexes(copy: ConduitSchema) {
  const convertedIndexes: ModelOptionsIndex[] = [];

  for (const index of copy.modelOptions.indexes!) {
    const { name, fields, types, options } = index;
    if (fields.length === 0) {
      throw new Error('Undefined fields for index creation');
    }
    if (fields.some(field => !Object.keys(copy.fields).includes(field))) {
      throw new Error(`Invalid fields for index creation`);
    }
    // Compound indexes are maintained in modelOptions in order to be created after schema creation
    // Single field index are added to specified schema field
    if (fields.length !== 1) {
      convertedIndexes.push(index);
      continue;
    }
    if (types) {
      const indexField = index.fields[0];
      if (
        !isArray(types) ||
        !Object.values(MongoIndexType).includes(types[0]) ||
        fields.length !== types.length
      ) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index type for MongoDB found in: ${copy.name}. Index ignored`,
        );
        continue;
      }
      (copy.fields[indexField] as ConduitModelField).index = {
        name,
        type: types[0] as MongoIndexType,
      };
    }
    if (options) {
      if (!checkIfMongoOptions(options)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index options for MongoDB found in: ${copy.name}. Index ignored`,
        );
        continue;
      }
      for (const [option, optionValue] of Object.entries(options)) {
        (copy.fields[index.fields[0]] as ConduitModelField).index![
          option as keyof SchemaFieldIndex
        ] = optionValue;
      }
    }
    convertedIndexes.push(index);
  }
  return convertedIndexes;
}
