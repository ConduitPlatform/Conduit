import {
  isArray,
  isBoolean,
  isNumber,
  isString,
  isObject,
  isNil,
  forEach,
  has,
} from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitModelField,
  Indexable,
  ModelOptionsIndex,
  MySQLMariaDBIndexType,
  PgIndexType,
  SequelizeIndexOptions,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';
import {
  checkIfSequelizeIndexOptions,
  checkIfSequelizeIndexType,
} from '../sequelize-adapter/utils/index.js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';

export function checkDefaultValue(type: string, value: string) {
  switch (type) {
    case 'String':
      if (isString(value)) return value;
      return '';
    case 'Number': {
      if (isNumber(value)) return value;
      const v = parseFloat(value);
      if (Number.isNaN(v)) return v;
      return 0;
    }
    case 'Boolean':
      if (isBoolean(value)) return value;
      return value === 'true';
    default:
      return value;
  }
}

export function convertModelOptionsIndexes(copy: ConduitDatabaseSchema, dialect: string) {
  const convertedIndexes = [];

  for (const index of copy.modelOptions.indexes!) {
    const { fields, types, options } = index;
    const compiledFields = Object.keys(copy.compiledFields);
    if (fields.length === 0) {
      throw new Error('Undefined fields for index creation');
    }
    if (fields.some(field => !compiledFields.includes(field))) {
      throw new Error(`Invalid fields for index creation`);
    }
    // Convert conduit indexes to sequelize indexes
    if (options) {
      if (!checkIfSequelizeIndexOptions(options, dialect)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index options for ${dialect} found in: ${copy.name}. Index ignored`,
        );
        continue;
      }
      // Used instead of ModelOptionsIndexes fields for more complex index definitions
      const seqOptions = options as SequelizeIndexOptions;
      if (
        !isNil(seqOptions.fields) &&
        seqOptions.fields.every(f => compiledFields.includes(f.name))
      ) {
        (index.fields as any) = seqOptions.fields;
        delete (index.options as SequelizeIndexOptions).fields;
      }
      Object.assign(index, options);
      delete index.options;
    }
    if (types) {
      if (types.length !== 1 || !checkIfSequelizeIndexType(types[0], dialect)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index type for ${dialect} found in: ${copy.name}. Index ignored`,
        );
        continue;
      }
      if (
        (dialect === 'mysql' || dialect === 'mariadb') &&
        ['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(types[0] as string)
      ) {
        index.type = types[0] as MySQLMariaDBIndexType;
      } else {
        index.using = types[0] as PgIndexType | SQLiteIndexType;
      }
      delete index.types;
    }
    convertedIndexes.push(index);
  }
  return convertedIndexes;
}

export function convertSchemaFieldIndexes(copy: ConduitDatabaseSchema, dialect: string) {
  const indexes = [];
  for (const [fieldName, fieldValue] of Object.entries(copy.fields)) {
    const index = (fieldValue as ConduitModelField).index;
    if (!index) continue;
    // Convert conduit indexes to sequelize indexes
    const { name, type, options } = index;
    const newIndex: any = { name, fields: [fieldName] };
    if (type) {
      if (isArray(type) || !checkIfSequelizeIndexType(type, dialect)) {
        ConduitGrpcSdk.Logger.warn(
          `Invalid index type for ${dialect} found in: ${copy.name}. Index ignored`,
        );
        delete (copy.fields[fieldName] as ConduitModelField).index;
        continue;
      }
      if (
        (dialect === 'mysql' || dialect === 'mariadb') &&
        ['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(type as string)
      ) {
        newIndex.type = type as MySQLMariaDBIndexType;
      } else {
        newIndex.using = type as PgIndexType | SQLiteIndexType;
      }
    }
    if (options && !checkIfSequelizeIndexOptions(options, dialect)) {
      ConduitGrpcSdk.Logger.warn(
        `Invalid index options for ${dialect} found in: ${copy.name}. Index ignored`,
      );
      delete (copy.fields[fieldName] as ConduitModelField).index;
      continue;
    }
    Object.assign(newIndex, options);
    indexes.push(newIndex);
    delete (copy.fields[fieldName] as ConduitModelField).index;
  }
  copy.modelOptions.indexes = copy.modelOptions.indexes
    ? [...copy.modelOptions.indexes, ...indexes]
    : indexes;
  return copy;
}

export function extractFieldProperties(
  objectField: Indexable,
  res: {
    type: any;
    defaultValue?: any;
    primaryKey?: boolean;
    unique?: boolean;
    allowNull?: boolean;
  } = { type: null },
) {
  if (objectField.hasOwnProperty('primaryKey') && objectField.primaryKey) {
    res.primaryKey = objectField.primaryKey ?? false;
    res.unique = true;
    res.allowNull = false;
  } else if (objectField.hasOwnProperty('unique') && objectField.unique) {
    res.unique = objectField.unique ?? false;
    res.allowNull = false;
  } else if (objectField.hasOwnProperty('required') && objectField.required) {
    res.allowNull = !objectField.required ?? true;
  }

  return res;
}

export function findAndRemoveIndex(schema: any, indexName: string) {
  const arrayIndex = schema.modelOptions.indexes.findIndex(
    (i: ModelOptionsIndex) => i.name === indexName,
  );
  if (arrayIndex !== -1) {
    schema.modelOptions.indexes.splice(arrayIndex, 1);
    return schema;
  }
  forEach(schema.fields, (value: ConduitModelField, key: string, fields: any) => {
    if (isObject(value) && has(value, 'index') && value.index!.name === indexName) {
      delete fields[key].index;
      delete schema.compiledFields[key].index;
      return schema;
    }
  });
  throw new Error('Index not found in schema');
}
