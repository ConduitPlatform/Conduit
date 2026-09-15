import { isBoolean, isNumber, isString } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitModelField,
  ConduitSchema,
  Indexable,
  ModelOptionsIndexes,
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
  type SqlIndexField,
} from './indexes.js';

type SqlEngineIndex = Omit<ModelOptionsIndexes, 'fields'> & {
  fields: SqlIndexField[];
  using?: PostgresIndexType;
};

function setSqlEngineIndexes(copy: ConduitSchema, indexes: SqlEngineIndex[]) {
  // Sequelize reads these through define(..., schema.modelOptions).
  copy.modelOptions.indexes = indexes as ModelOptionsIndexes[];
}

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

function skipIndex(schemaName: string, dialect: string, reason: string) {
  ConduitGrpcSdk.Logger.warn(
    `Invalid index ${reason} for ${dialect} found in '${schemaName}', ignoring index`,
  );
}

function toSqlEngineIndex(
  raw: ModelOptionsIndexes,
  dialect: string,
  schemaName: string,
): SqlEngineIndex | null {
  const index = ensureIndexName({ ...raw, fields: [...raw.fields] });
  if (index.options && !checkIfPostgresOptions(index.options)) {
    skipIndex(schemaName, dialect, 'options');
    return null;
  }

  let fields: SqlIndexField[] = [...index.fields];
  let using = PostgresIndexType.BTREE;
  if (index.types) {
    const types = normalizeIndexTypes(index.types, index.fields.length) ?? [];
    if (types.some(type => !sqlDialectAllowsIndexType(dialect, type))) {
      skipIndex(schemaName, dialect, 'type');
      return null;
    }
    if (types.some(isPortableDirection)) {
      fields = index.fields.map((field, i) => ({
        name: field,
        order: mapCompatibleToSqlOrder(types[i]),
      }));
    } else if (types.length === 1 && isPostgresIndexType(types[0])) {
      using = types[0];
    } else {
      skipIndex(schemaName, dialect, 'type');
      return null;
    }
  }

  return {
    ...index.options,
    name: index.name,
    fields,
    using,
    unique: index.options?.unique,
  };
}

export function convertModelOptionsIndexes(copy: ConduitSchema, dialect = 'postgres') {
  const converted: SqlEngineIndex[] = [];
  for (const raw of copy.modelOptions.indexes ?? []) {
    const index = toSqlEngineIndex(raw, dialect, copy.name);
    if (index) converted.push(index);
  }
  setSqlEngineIndexes(copy, converted);
  return copy;
}

export function convertSchemaFieldIndexes(copy: ConduitSchema, dialect = 'postgres') {
  const indexes: SqlEngineIndex[] = [];
  for (const [fieldName, fieldValue] of Object.entries(copy.fields)) {
    const field = fieldValue as ConduitModelField;
    const index = field.index;
    if (!index) continue;
    if (index.type && !sqlDialectAllowsIndexType(dialect, index.type)) {
      skipIndex(copy.name, dialect, 'type');
      delete field.index;
      continue;
    }
    const converted = toSqlEngineIndex(
      {
        fields: [fieldName],
        types: index.type === undefined ? undefined : [index.type],
        options: index.options,
        name: index.name,
      },
      dialect,
      copy.name,
    );
    delete field.index;
    if (converted) indexes.push(converted);
  }
  setSqlEngineIndexes(copy, [
    ...((copy.modelOptions.indexes ?? []) as SqlEngineIndex[]),
    ...indexes,
  ]);
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
