import { createHash } from 'crypto';
import {
  CompatibleIndexType,
  ConduitModelField,
  GrpcError,
  ModelOptionsIndexes,
  MongoIndexType,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';

export const ADMIN_INDEX_CALLER = 'database';

export const MONGO_INDEX_TYPE_VALUES: ReadonlyArray<MongoIndexType> = [
  MongoIndexType.Ascending,
  MongoIndexType.Descending,
  MongoIndexType.GeoSpatial2d,
  MongoIndexType.GeoSpatial2dSphere,
  MongoIndexType.GeoHaystack,
  MongoIndexType.Hashed,
  MongoIndexType.Text,
];

const SQL_IDENTIFIER_MAX_LEN = 63;

export function isCompatibleIndexType(value: unknown): value is CompatibleIndexType {
  return (
    value === CompatibleIndexType.Ascending || value === CompatibleIndexType.Descending
  );
}

export function isMongoIndexType(value: unknown): value is MongoIndexType {
  return (MONGO_INDEX_TYPE_VALUES as readonly unknown[]).includes(value);
}

export function isPostgresIndexType(value: unknown): value is PostgresIndexType {
  return Object.values(PostgresIndexType).includes(value as PostgresIndexType);
}

export function resolveIndexName(index: ModelOptionsIndexes): string | undefined {
  if (typeof index.name === 'string' && index.name.length > 0) return index.name;
  const optionsName = index.options?.name;
  if (typeof optionsName === 'string' && optionsName.length > 0) return optionsName;
  return undefined;
}

export function isUniqueIndex(index: ModelOptionsIndexes): boolean {
  return index.options?.unique === true;
}

export function normalizeIndexTypes(
  types: ModelOptionsIndexes['types'],
  fieldCount: number,
): unknown[] | undefined {
  if (types === undefined) return undefined;
  if (Array.isArray(types)) {
    return [...types];
  }
  return Array.from({ length: fieldCount }, () => types);
}

function typeToken(type: unknown): string {
  if (type === undefined || type === CompatibleIndexType.Ascending) return 'asc';
  if (type === CompatibleIndexType.Descending) return 'desc';
  if (type === MongoIndexType.Ascending || type === 1) return 'asc';
  if (type === MongoIndexType.Descending || type === -1) return 'desc';
  if (typeof type === 'string') return type.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return String(type);
}

export function generateIndexName(
  fields: readonly string[],
  types?: ModelOptionsIndexes['types'],
  unique = false,
): string {
  const tokens = (
    normalizeIndexTypes(types, fields.length) ?? fields.map(() => undefined)
  )
    .map(typeToken)
    .join('_');
  const prefix = unique ? 'cnd_uidx' : 'cnd_idx';
  const raw = `${prefix}_${fields.join('_')}_${tokens}`.replace(/[^A-Za-z0-9_]+/g, '_');
  const sanitized = raw.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (sanitized.length <= SQL_IDENTIFIER_MAX_LEN) return sanitized;
  const hash = createHash('sha1').update(sanitized).digest('hex').slice(0, 8);
  return `${sanitized.slice(0, SQL_IDENTIFIER_MAX_LEN - 9)}_${hash}`;
}

export function ensureIndexName(index: ModelOptionsIndexes): ModelOptionsIndexes {
  const existing = resolveIndexName(index);
  if (existing) {
    return {
      ...index,
      name: existing,
      options: { ...index.options, name: existing },
    };
  }
  const name = generateIndexName(index.fields, index.types, isUniqueIndex(index));
  return {
    ...index,
    name,
    options: { ...index.options, name },
  };
}

export function mapCompatibleToMongo(type: unknown): MongoIndexType {
  if (type === CompatibleIndexType.Descending) return MongoIndexType.Descending;
  if (type === CompatibleIndexType.Ascending || type === undefined) {
    return MongoIndexType.Ascending;
  }
  if (isMongoIndexType(type)) return type;
  throw new GrpcError(status.INVALID_ARGUMENT, `Invalid index type for MongoDB: ${type}`);
}

export function mapCompatibleToSqlOrder(type: unknown): 'ASC' | 'DESC' {
  if (type === CompatibleIndexType.Descending || type === MongoIndexType.Descending) {
    return 'DESC';
  }
  return 'ASC';
}

export function isPortableDirection(type: unknown): boolean {
  return (
    isCompatibleIndexType(type) ||
    type === MongoIndexType.Ascending ||
    type === MongoIndexType.Descending
  );
}

export function sqlDialectAllowsIndexType(dialect: string, type: unknown): boolean {
  if (type === undefined || isPortableDirection(type)) return true;
  if (type === PostgresIndexType.BTREE) return true;
  if (type === PostgresIndexType.HASH) {
    return dialect === 'postgres' || dialect === 'mysql' || dialect === 'mariadb';
  }
  if (isPostgresIndexType(type)) return dialect === 'postgres';
  return false;
}

export function mongoAllowsIndexType(type: unknown): boolean {
  return type === undefined || isCompatibleIndexType(type) || isMongoIndexType(type);
}

export function mergeDeclaredIndexes(
  existing: readonly ModelOptionsIndexes[] | undefined,
  incoming: readonly ModelOptionsIndexes[],
): ModelOptionsIndexes[] {
  const merged = new Map<string, ModelOptionsIndexes>();
  for (const index of existing ?? []) {
    const named = ensureIndexName(index);
    merged.set(resolveIndexName(named)!, named);
  }
  for (const index of incoming) {
    const named = ensureIndexName(index);
    const name = resolveIndexName(named)!;
    if (!merged.has(name)) {
      merged.set(name, named);
    }
  }
  return [...merged.values()];
}

export function removeDeclaredIndexes(
  existing: readonly ModelOptionsIndexes[] | undefined,
  names: readonly string[],
): ModelOptionsIndexes[] {
  const drop = new Set(names);
  return (existing ?? []).filter(index => {
    const name = resolveIndexName(index);
    return !name || !drop.has(name);
  });
}

export function removeIndexFromSchemaFields(
  schema: { fields?: Record<string, unknown>; compiledFields?: Record<string, unknown> },
  indexName: string,
): boolean {
  let removed = false;
  for (const bag of [schema.fields, schema.compiledFields]) {
    if (!bag) continue;
    for (const value of Object.values(bag)) {
      if (!value || typeof value !== 'object') continue;
      const field = value as ConduitModelField;
      const name = field.index?.options?.name ?? (field.index as { name?: string })?.name;
      if (name === indexName) {
        delete field.index;
        removed = true;
      }
    }
  }
  return removed;
}

export function validateIndexFields(
  schema: Pick<ConduitDatabaseSchema, 'compiledFields' | 'fields'>,
  index: ModelOptionsIndexes,
) {
  if (!index.fields || index.fields.length === 0) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Index fields must be a non-empty array',
    );
  }
  const available = new Set([
    ...Object.keys(schema.compiledFields ?? {}),
    ...Object.keys(schema.fields ?? {}),
  ]);
  const missing = index.fields.filter(field => !available.has(field));
  if (missing.length > 0) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Invalid fields for index creation: ${missing.join(', ')}`,
    );
  }
}

export function assertUniqueIndexPrivilege(args: {
  unique: boolean;
  schemaOwner: string;
  callerModule: string;
  privileged?: boolean;
}) {
  if (!args.unique) return;
  if (args.privileged) return;
  if (args.schemaOwner === args.callerModule) return;
  throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to create unique index');
}

export function isIndexAlreadyExistsError(error: unknown): boolean {
  const err = error as { message?: string; code?: number | string; name?: string };
  const message = (err.message ?? '').toLowerCase();
  if (
    message.includes('already exists') ||
    message.includes('already exist') ||
    message.includes('duplicate key name') ||
    message.includes('index already exists')
  ) {
    return true;
  }
  return (
    err.code === 85 ||
    err.code === '42P07' ||
    err.name === 'SequelizeUniqueConstraintError'
  );
}

export async function persistDeclaredSchemaIndexes(args: {
  declaredSchemaModel: {
    findOne: (query: Record<string, unknown>) => Promise<{ _id: string } | null>;
    findByIdAndUpdate: (id: string, update: Record<string, unknown>) => Promise<unknown>;
  };
  schemaName: string;
  originalSchema: {
    modelOptions: { indexes?: ModelOptionsIndexes[] | readonly ModelOptionsIndexes[] };
    fields?: Record<string, unknown>;
    compiledFields?: Record<string, unknown>;
  };
  indexes: ModelOptionsIndexes[];
}): Promise<void> {
  args.originalSchema.modelOptions.indexes = args.indexes;
  const found = await args.declaredSchemaModel.findOne({ name: args.schemaName });
  if (!found) return;
  await args.declaredSchemaModel.findByIdAndUpdate(found._id, {
    modelOptions: args.originalSchema.modelOptions,
    fields: args.originalSchema.fields,
    compiledFields: args.originalSchema.compiledFields,
  });
}

export function collectExistingIndexNames(
  indexes: readonly ModelOptionsIndexes[],
): Set<string> {
  const names = new Set<string>();
  for (const index of indexes) {
    const name = resolveIndexName(index);
    if (name) names.add(name);
  }
  return names;
}

export function toMutableIndexes(
  indexes: readonly ModelOptionsIndexes[],
): ModelOptionsIndexes[] {
  return indexes.map(index => ({
    ...index,
    fields: [...index.fields],
    types: Array.isArray(index.types) ? [...index.types] : index.types,
    options: index.options ? { ...index.options } : index.options,
  }));
}

export function sqlIndexFields(
  index: ModelOptionsIndexes,
): Array<string | { name: string; order: 'ASC' | 'DESC' }> {
  const types = normalizeIndexTypes(index.types, index.fields.length);
  if (!types || !types.some(isCompatibleIndexType)) {
    return [...index.fields];
  }
  return index.fields.map((field, i) => ({
    name: field,
    order: mapCompatibleToSqlOrder(types[i]),
  }));
}

export function inferSqlIndexType(
  row: { type?: string; definition?: string },
  dialect: string,
): PostgresIndexType | undefined {
  if (typeof row.type === 'string' && row.type.length > 0) {
    const upper = row.type.toUpperCase();
    if (isPostgresIndexType(upper)) return upper;
  }
  if (typeof row.definition === 'string') {
    const match = /USING\s+(\w+)/i.exec(row.definition);
    if (match && isPostgresIndexType(match[1].toUpperCase())) {
      return match[1].toUpperCase() as PostgresIndexType;
    }
  }
  if (
    dialect === 'postgres' ||
    dialect === 'mysql' ||
    dialect === 'mariadb' ||
    dialect === 'sqlite'
  ) {
    return PostgresIndexType.BTREE;
  }
  return undefined;
}
