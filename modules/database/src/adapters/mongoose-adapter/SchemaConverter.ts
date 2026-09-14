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
import { applyMongoVectorField } from '../utils/vectorMappings.js';
import { isVectorTypeName } from '../utils/vectorField.js';
import {
  isCompatibleIndexType,
  mapCompatibleToMongo,
  mongoAllowsIndexType,
  normalizeIndexTypes,
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

  if (isVectorTypeName(parentValue[key]?.type)) {
    parentValue[key] = applyMongoVectorField(parentValue[key]);
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
  const remaining: ModelOptionsIndexes[] = [];
  for (const index of copy.modelOptions.indexes) {
    let mappedTypes: MongoIndexType[] | undefined;
    if (index.types) {
      const types = normalizeIndexTypes(index.types, index.fields.length) ?? [];
      if (
        types.some(type => !mongoAllowsIndexType(type)) ||
        (isArray(index.types) && index.fields.length !== index.types.length)
      ) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index type for MongoDB found in '${copy.name}', ignoring index`,
        );
        continue;
      }
      mappedTypes = types.map(mapCompatibleToMongo);
      index.types = mappedTypes;
    }
    // compound indexes stay on modelOptions and are created after schema creation
    if (index.fields.length !== 1) {
      remaining.push(index);
      continue;
    }
    const modelField = copy.fields[index.fields[0]] as ConduitModelField;
    if (!modelField) {
      throw new Error(`Field ${index.fields[0]} in index definition doesn't exist`);
    }
    if (index.options && !checkIfMongoOptions(index.options)) {
      ConduitGrpcSdk.Logger.warn(
        `Invalid index options for MongoDB found in '${copy.name}', ignoring index`,
      );
      continue;
    }
    modelField.index = {
      ...(mappedTypes ? { type: mappedTypes[0] } : {}),
      ...index.options,
    };
  }
  copy.modelOptions.indexes = remaining;
  return copy;
}
