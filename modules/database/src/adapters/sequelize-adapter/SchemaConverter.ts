import {
  ConduitModelField,
  ConduitSchema,
  PostgresIndexOptions,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import { DataTypes } from 'sequelize';
import { cloneDeep, isArray, isBoolean, isNumber, isObject, isString } from 'lodash';
import { checkIfPostgresOptions } from './utils';

/**
 * This function should take as an input a JSON schema and convert it to the sequelize equivalent
 * @param jsonSchema
 */
export function schemaConverter(
  jsonSchema: ConduitSchema,
  dialect: string,
): [
  ConduitSchema,
  { [key: string]: any },
  {
    [key: string]:
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
  },
] {
  let copy = cloneDeep(jsonSchema);
  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }
  if (copy.modelOptions.indexes) {
    copy = convertModelOptionsIndexes(copy);
  }
  const extractedEmbedded = extractEmbedded(jsonSchema.fields, copy.fields);
  const extractedRelations = extractRelations(jsonSchema.fields, copy.fields);
  copy = convertSchemaFieldIndexes(copy);
  iterDeep(jsonSchema.fields, copy.fields, dialect);
  return [copy, extractedEmbedded, extractedRelations];
}

function extractEmbedded(ogSchema: any, schema: any) {
  let extracted: { [key: string]: any } = {};
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      let arrayField = schema[key];
      if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
        if (
          !arrayField[0].hasOwnProperty('type') ||
          typeof arrayField[0].type !== 'string'
        ) {
          extracted[key] = [arrayField[0]];
          delete schema[key];
          delete ogSchema[key];
        }
      }
    } else if (isObject(schema[key])) {
      if (!schema[key].hasOwnProperty('type') || typeof schema[key].type !== 'string') {
        extracted[key] = schema[key];
        delete schema[key];
        delete ogSchema[key];
      }
    }
  }
  return extracted;
}

function extractRelations(ogSchema: any, schema: any) {
  let extracted: {
    [key: string]:
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }
      | { type: 'Relation'; model: string; required?: boolean; select?: boolean }[];
  } = {};
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      let arrayField = schema[key];
      if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
        if (arrayField[0].hasOwnProperty('type') && arrayField[0].type === 'Relation') {
          extracted[key] = [{ ...arrayField[0] }];
          delete schema[key];
          delete ogSchema[key];
        }
      }
    } else if (isObject(schema[key])) {
      if (schema[key].hasOwnProperty('type') && schema[key].type === 'Relation') {
        extracted[key] = { ...schema[key] };
        delete schema[key];
        delete ogSchema[key];
      }
    }
  }
  return extracted;
}

function iterDeep(schema: any, resSchema: any, dialect: string) {
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      resSchema[key] = extractArrayType(schema[key], dialect);
    } else if (isObject(schema[key])) {
      resSchema[key] = extractObjectType(schema[key], dialect);
      if (!schema[key].hasOwnProperty('type')) {
        iterDeep(schema[key], resSchema[key], dialect);
      }
    } else {
      resSchema[key] = extractType(schema[key], dialect);
    }
  }
}

function extractArrayType(arrayField: any[], dialect: string) {
  let arrayElementType;
  if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
    if (arrayField[0].hasOwnProperty('type')) {
      arrayElementType = extractType(arrayField[0].type, dialect);
    } else {
      throw new Error('Failed to extract embedded object type');
    }
  } else {
    arrayElementType = extractType(arrayField[0], dialect);
  }
  return { type: DataTypes.ARRAY(arrayElementType) };
}

function extractObjectType(objectField: any, dialect: string) {
  const res: { type: any; defaultValue?: any; primaryKey?: boolean } = { type: null };

  if (objectField.hasOwnProperty('type')) {
    res.type = extractType(objectField.type, dialect);
    if (objectField.hasOwnProperty('default')) {
      res.defaultValue = checkDefaultValue(objectField.type, objectField.default);
    }
  } else {
    throw new Error('Failed to extract embedded object type');
  }

  if (objectField.hasOwnProperty('primaryKey') && objectField.primaryKey) {
    res.primaryKey = objectField.primaryKey ?? false;
  }

  return res;
}

function extractType(type: string, dialect: string) {
  switch (type) {
    case 'String':
      return DataTypes.STRING;
    case 'Number':
      return DataTypes.FLOAT;
    case 'Boolean':
      return DataTypes.BOOLEAN;
    case 'Date':
      return DataTypes.DATE;
    case 'JSON':
      return dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;
    case 'Relation':
    case 'ObjectId':
      return DataTypes.UUID;
  }

  throw new Error('Failed to extract embedded object type');
}

function checkDefaultValue(type: string, value: string) {
  switch (type) {
    case 'String':
      if (isString(value)) return value;
      return '';
    case 'Number':
      if (isNumber(value)) return value;
      const v = parseFloat(value);
      if (Number.isNaN(v)) return v;
      return 0;
    case 'Boolean':
      if (isBoolean(value)) return value;
      return value === 'true';
    default:
      return value;
  }
}

function convertModelOptionsIndexes(copy: ConduitSchema) {
  for (const index of copy.modelOptions.indexes!) {
    if (index.types) {
      if (
        isArray(index.types) ||
        !Object.values(PostgresIndexType).includes(index.types as PostgresIndexType)
      ) {
        throw new Error('Incorrect index type for PostgreSQL');
      }
      index.using = index.types as PostgresIndexType;
      delete index.types;
    }
    if (index.options) {
      if (!checkIfPostgresOptions(index.options)) {
        throw new Error('Incorrect index options for PostgreSQL');
      }
      for (const [option, value] of Object.entries(index.options)) {
        index[option as keyof PostgresIndexOptions] = value;
      }
      delete index.options;
    }
  }
  return copy;
}

function convertSchemaFieldIndexes(copy: ConduitSchema) {
  const indexes = [];
  for (const field of Object.entries(copy.fields)) {
    const fieldName = field[0];
    const index = (copy.fields[fieldName] as ConduitModelField).index;
    if (!index) continue;
    const newIndex: any = {
      fields: [fieldName],
    };
    if (index.type) {
      if (!Object.values(PostgresIndexType).includes(index.type as PostgresIndexType)) {
        throw new Error('Invalid index type for PostgreSQL');
      }
      newIndex.using = index.type;
    }
    if (index.options) {
      if (!checkIfPostgresOptions(index.options)) {
        throw new Error('Invalid index options for PostgreSQL');
      }
      for (const [option, value] of Object.entries(index.options)) {
        newIndex[option] = value;
      }
    }
    indexes.push(newIndex);
    delete copy.fields[fieldName];
  }
  if (copy.modelOptions.indexes) {
    copy.modelOptions.indexes = [...copy.modelOptions.indexes, ...indexes];
  } else {
    copy.modelOptions.indexes = indexes;
  }
  return copy;
}
