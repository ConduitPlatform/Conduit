import { Schema } from 'mongoose';
import {
  ConduitGrpcSdk,
  ConduitModelField,
  ConduitSchema,
  ModelOptionsIndexes,
  MongoIndexType,
  SchemaFieldIndex,
} from '@conduitplatform/grpc-sdk';
import { cloneDeep, isArray, isNil, isObject } from 'lodash-es';
import { checkIfMongoOptions } from './utils.js';
import {
  isCompatibleIndexType,
  isMongoIndexType,
  mapCompatibleToMongo,
  mongoAllowsIndexType,
} from '../utils/indexes.js';

import * as deepdash from 'deepdash-es/standalone';

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
    if (type && !mongoAllowsIndexType(type)) {
      ConduitGrpcSdk.Logger.warn(
        `Invalid index type for MongoDB found in '${copy.name}', ignoring index`,
      );
      delete (field[1] as ConduitModelField).index;
      continue;
    }
    if (type && isCompatibleIndexType(type)) {
      index.type = mapCompatibleToMongo(type);
    }
    if (options) {
      if (!checkIfMongoOptions(options)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index options for MongoDB found in '${copy.name}', ignoring index`,
        );
        delete (field[1] as ConduitModelField).index;
        continue;
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
  if (!copy.modelOptions.indexes?.length) return copy;
  const mutIndexes = copy.modelOptions.indexes as ModelOptionsIndexes[];
  for (const index of [...mutIndexes]) {
    if (index.types) {
      const types = isArray(index.types)
        ? index.types
        : index.fields.map(() => index.types);
      if (
        types.some(type => !mongoAllowsIndexType(type)) ||
        (isArray(index.types) && index.fields.length !== index.types.length)
      ) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index type for MongoDB found in '${copy.name}', ignoring index`,
        );
        mutIndexes.splice(mutIndexes.indexOf(index), 1);
        continue;
      }
      index.types = types.map(type =>
        isCompatibleIndexType(type) || isMongoIndexType(type)
          ? mapCompatibleToMongo(type)
          : (type as MongoIndexType),
      ) as MongoIndexType[];
    }
    // compound indexes are maintained in modelOptions in order to be created after schema creation
    // single field index => add it to specified schema field
    if (index.fields.length !== 1) continue;
    const modelField = copy.fields[index.fields[0]] as ConduitModelField;
    if (!modelField) {
      throw new Error(`Field ${index.fields[0]} in index definition doesn't exist`);
    }
    if (index.types) {
      modelField.index = {
        type: (index.types as MongoIndexType[])[0],
      };
    }
    if (index.options) {
      if (!checkIfMongoOptions(index.options)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index options for MongoDB found in '${copy.name}', ignoring index`,
        );
        mutIndexes.splice(mutIndexes.indexOf(index), 1);
        continue;
      }
      if (!modelField.index) modelField.index = {};
      for (const [option, optionValue] of Object.entries(index.options)) {
        modelField.index![option as keyof SchemaFieldIndex] = optionValue;
      }
    }
    mutIndexes.splice(mutIndexes.indexOf(index), 1);
  }
  return copy;
}
