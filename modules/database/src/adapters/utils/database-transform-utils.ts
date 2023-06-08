import { isArray, isBoolean, isNumber, isString } from 'lodash';
import {
  ConduitModelField,
  ConduitSchema,
  Indexable,
  MySQLMariaDBIndexType,
  PostgresIndexType,
  SequelizeIndexType,
  SQLIndexType,
  SQLiteIndexType,
} from '@conduitplatform/grpc-sdk';
import {
  checkIfSequelizeIndexType,
  checkIfSequelizeIndexOptions,
} from '../sequelize-adapter/utils';

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

export function convertModelOptionsIndexes(copy: ConduitSchema) {
  for (const index of copy.modelOptions.indexes!) {
    if (index.options) {
      if (!checkIfSequelizeIndexOptions(index.options)) {
        throw new Error('Incorrect index options for sequelize');
      }
      // if ((index.options as SequelizeIndexOptions).fields) { // TODO: integrate this logic somehow
      //   delete index.fields;
      // }
      Object.assign(index, index.options);
      delete index.options;
    }
    if (index.types) {
      // TODO: put null to check
      if (isArray(index.types) || !checkIfSequelizeIndexType(index.types)) {
        throw new Error('Invalid index type');
      }
      if (index.types in MySQLMariaDBIndexType) {
        index.type = index.types as MySQLMariaDBIndexType;
      } else {
        index.using = index.types as SQLIndexType | PostgresIndexType | SQLiteIndexType;
      }
      delete index.types;
    }
  }
  return copy;
}

export function convertSchemaFieldIndexes(copy: ConduitSchema) {
  const indexes = [];
  for (const [fieldName, fieldValue] of Object.entries(copy.fields)) {
    const field = fieldValue as ConduitModelField;
    // Move unique field indexes to modelOptions workaround
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
      if (isArray(index.type) || !checkIfSequelizeIndexType(index.type)) {
        throw new Error('Invalid index type');
      }
      if (!(index.type in MySQLMariaDBIndexType)) {
        newIndex.using = index.type as SQLIndexType | PostgresIndexType | SQLiteIndexType;
      } else {
        newIndex.type = index.type as MySQLMariaDBIndexType;
      }
    }
    if (index.options && !checkIfSequelizeIndexOptions(index.options)) {
      throw new Error('Invalid index options for sequelize');
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
