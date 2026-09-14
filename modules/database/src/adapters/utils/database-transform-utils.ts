import { isBoolean, isNumber, isString } from 'lodash-es';
import {
  CompatibleIndexType,
  ConduitGrpcSdk,
  ConduitModelField,
  ConduitSchema,
  Indexable,
  ModelOptionsIndexes,
  PostgresIndexOptions,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import { checkIfPostgresOptions } from '../sequelize-adapter/utils/index.js';
import {
  ensureIndexName,
  isPortableDirection,
  isPostgresIndexType,
  mapCompatibleToSqlOrder,
  normalizeIndexTypes,
  sqlDialectAllowsIndexType,
} from './indexes.js';

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

function flattenSqlIndexOptions(index: ModelOptionsIndexes, dialect: string): boolean {
  if (!index.options) return true;
  if (!checkIfPostgresOptions(index.options)) {
    ConduitGrpcSdk.Logger.warn(
      `Invalid index options for ${dialect} found in '${copyName(index)}', ignoring index`,
    );
    return false;
  }
  for (const [option, value] of Object.entries(index.options)) {
    index[option as keyof PostgresIndexOptions] = value;
  }
  delete index.options;
  return true;
}

function copyName(index: ModelOptionsIndexes): string {
  return index.name ?? index.fields?.join(',') ?? 'unnamed';
}

function applySqlIndexTypes(
  index: ModelOptionsIndexes,
  dialect: string,
  schemaName: string,
): boolean {
  if (!index.types) {
    index.using = PostgresIndexType.BTREE;
    return true;
  }
  const types = normalizeIndexTypes(index.types, index.fields.length) ?? [];
  if (types.some(type => !sqlDialectAllowsIndexType(dialect, type))) {
    ConduitGrpcSdk.Logger.warn(
      `Invalid index type for ${dialect} found in '${schemaName}', ignoring index`,
    );
    return false;
  }
  if (types.some(isPortableDirection)) {
    index.fields = index.fields.map((field, i) => ({
      name: field,
      order: mapCompatibleToSqlOrder(types[i]),
    })) as unknown as string[];
    index.using = PostgresIndexType.BTREE;
  } else if (types.length === 1 && isPostgresIndexType(types[0])) {
    index.using = types[0];
  } else {
    ConduitGrpcSdk.Logger.warn(
      `Invalid index type for ${dialect} found in '${schemaName}', ignoring index`,
    );
    return false;
  }
  delete index.types;
  return true;
}

export function convertModelOptionsIndexes(copy: ConduitSchema, dialect = 'postgres') {
  const converted: ModelOptionsIndexes[] = [];
  for (const raw of copy.modelOptions.indexes ?? []) {
    const index = ensureIndexName({ ...raw, fields: [...raw.fields] });
    if (!applySqlIndexTypes(index, dialect, copy.name)) continue;
    if (!flattenSqlIndexOptions(index, dialect)) continue;
    if (!index.using) index.using = PostgresIndexType.BTREE;
    converted.push(index);
  }
  copy.modelOptions.indexes = converted;
  return copy;
}

export function convertSchemaFieldIndexes(copy: ConduitSchema, dialect = 'postgres') {
  const indexes: ModelOptionsIndexes[] = [];
  for (const [fieldName, fieldValue] of Object.entries(copy.fields)) {
    const index = (fieldValue as ConduitModelField).index;
    if (!index) continue;
    const newIndex = ensureIndexName({
      fields: [fieldName],
      types: index.type
        ? isPortableDirection(index.type)
          ? [index.type as CompatibleIndexType]
          : (index.type as PostgresIndexType)
        : undefined,
      options: index.options,
      name: (index as { name?: string }).name,
    });
    if (index.type && !sqlDialectAllowsIndexType(dialect, index.type)) {
      ConduitGrpcSdk.Logger.warn(
        `Invalid index type for ${dialect} found in '${copy.name}', ignoring index`,
      );
      delete (copy.fields[fieldName] as ConduitModelField).index;
      continue;
    }
    if (!applySqlIndexTypes(newIndex, dialect, copy.name)) {
      delete (copy.fields[fieldName] as ConduitModelField).index;
      continue;
    }
    if (!flattenSqlIndexOptions(newIndex, dialect)) {
      delete (copy.fields[fieldName] as ConduitModelField).index;
      continue;
    }
    indexes.push(newIndex);
    delete (copy.fields[fieldName] as ConduitModelField).index;
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
    // @ts-expect-error
    res.allowNull = !objectField.required ?? true;
  }

  return res;
}
