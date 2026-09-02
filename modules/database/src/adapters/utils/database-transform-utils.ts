import { isArray, isBoolean, isNumber, isString } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitModelField,
  ConduitSchema,
  Indexable,
  PostgresIndexOptions,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import { checkIfPostgresOptions } from '../sequelize-adapter/utils/index.js';

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
    if (index.types) {
      if (
        isArray(index.types) ||
        !Object.values(PostgresIndexType).includes(index.types as PostgresIndexType)
      ) {
        // ignore index instead of error
        ConduitGrpcSdk.Logger.warn('Invalid index type for PostgreSQL, ignoring index');
        continue;
        // throw new Error('Incorrect index type for PostgreSQL');
      }
      index.using = index.types as PostgresIndexType;
      delete index.types;
    }
    if (index.options) {
      if (!checkIfPostgresOptions(index.options)) {
        // ignore index instead of error
        ConduitGrpcSdk.Logger.warn(
          'Invalid index options for PostgreSQL, ignoring index',
        );
        continue;
        // throw new Error('Incorrect index options for PostgreSQL');
      }
      for (const [option, value] of Object.entries(index.options)) {
        index[option as keyof PostgresIndexOptions] = value;
      }
      delete index.options;
    }
  }
  return copy;
}

export function convertSchemaFieldIndexes(copy: ConduitSchema) {
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
        // ignore index instead of error
        ConduitGrpcSdk.Logger.warn('Invalid index type for PostgreSQL, ignoring index');
        continue;
        // throw new Error('Invalid index type for PostgreSQL');
      }
      newIndex.using = index.type;
    }
    if (index.options) {
      if (!checkIfPostgresOptions(index.options)) {
        // ignore index instead of error
        ConduitGrpcSdk.Logger.warn(
          'Invalid index options for PostgreSQL, ignoring index',
        );
        continue;
        // throw new Error('Invalid index options for PostgreSQL');
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
