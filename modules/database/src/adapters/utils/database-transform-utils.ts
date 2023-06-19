import { isArray, isBoolean, isNil, isNumber, isString } from 'lodash';
import {
  ConduitModelField,
  Indexable,
  MySQLMariaDBIndexType,
  PgIndexType,
  SequelizeIndexOptions,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';
import {
  checkIfSequelizeIndexOptions,
  checkIfSequelizeIndexType,
} from '../sequelize-adapter/utils';
import { ConduitDatabaseSchema } from '../../interfaces';

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
        throw new Error(`Invalid index options for ${dialect}`);
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
      if (isArray(types) || !checkIfSequelizeIndexType(types, dialect)) {
        throw new Error(`Invalid index type for ${dialect}`);
      }
      if (types in MySQLMariaDBIndexType) {
        index.type = types as MySQLMariaDBIndexType;
      } else {
        index.using = types as PgIndexType | SQLiteIndexType;
      }
      delete index.types;
    }
  }
  return copy;
}

export function convertSchemaFieldIndexes(copy: ConduitDatabaseSchema, dialect: string) {
  const indexes = [];
  for (const [fieldName, fieldValue] of Object.entries(copy.fields)) {
    const field = fieldValue as ConduitModelField;
    // Move unique field constraints to modelOptions workaround
    if (field.unique) {
      field.index = {
        options: { unique: true },
      };
      delete (field as ConduitModelField).unique;
    }
    const index = field.index;
    if (!index) continue;
    // Convert conduit indexes to sequelize indexes
    const { type, options } = index;
    const newIndex: any = { fields: [fieldName] };
    if (type) {
      if (isArray(type) || !checkIfSequelizeIndexType(type, dialect)) {
        throw new Error(`Invalid index type for ${dialect}`);
      }
      if (!(type in MySQLMariaDBIndexType)) {
        newIndex.using = type as PgIndexType | SQLiteIndexType;
      } else {
        newIndex.type = type as MySQLMariaDBIndexType;
      }
    }
    if (options && !checkIfSequelizeIndexOptions(options, dialect)) {
      throw new Error(`Invalid index options for ${dialect}`);
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
