import { isArray, isBoolean, isNumber, isString } from 'lodash';
import {
  ConduitModelField,
  Indexable,
  MySQLMariaDBIndexType,
  PgIndexType,
  SQLIndexType,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';
import {
  checkSequelizeIndexOptions,
  checkSequelizeIndexType,
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
    if (index.fields.some(field => !Object.keys(copy.compiledFields).includes(field))) {
      throw new Error(`Invalid fields for index creation`);
    }
    if (index.options) {
      if (!checkSequelizeIndexOptions(index.options, dialect)) {
        throw new Error(`Invalid index options for ${dialect}`);
      }
      // if ((index.options as SequelizeIndexOptions).fields) { // TODO: integrate this logic somehow
      //   delete index.fields;
      // }
      Object.assign(index, index.options);
      delete index.options;
    }
    if (index.types) {
      // TODO: put null to check
      if (isArray(index.types) || !checkSequelizeIndexType(index.types, dialect)) {
        throw new Error(`Invalid index type for ${dialect}`);
      }
      if (index.types in MySQLMariaDBIndexType) {
        index.type = index.types as MySQLMariaDBIndexType;
      } else {
        index.using = index.types as SQLIndexType | PgIndexType | SQLiteIndexType;
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
    // if (field.unique && fieldName !== '_id') {
    //   field.index = {
    //     options: { unique: true }
    //   };
    //   delete (field as ConduitModelField).unique;
    // }
    const index = field.index;
    if (!index) continue;
    const newIndex: any = { fields: [fieldName] }; // TODO: remove this any
    if (index.type) {
      if (isArray(index.type) || !checkSequelizeIndexType(index.type, dialect)) {
        throw new Error(`Invalid index type for ${dialect}`);
      }
      if (!(index.type in MySQLMariaDBIndexType)) {
        newIndex.using = index.type as SQLIndexType | PgIndexType | SQLiteIndexType;
      } else {
        newIndex.type = index.type as MySQLMariaDBIndexType;
      }
    }
    if (index.options && !checkSequelizeIndexOptions(index.options, dialect)) {
      throw new Error(`Invalid index options for ${dialect}`);
    }
    Object.assign(newIndex, index.options);
    indexes.push(newIndex);
    delete copy.fields[fieldName];
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
