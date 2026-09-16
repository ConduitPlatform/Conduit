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

const MONGO_INDEX_TYPE_VALUES: ReadonlySet<unknown> = new Set([
  MongoIndexType.Ascending,
  MongoIndexType.Descending,
  MongoIndexType.GeoSpatial2d,
  MongoIndexType.GeoSpatial2dSphere,
  MongoIndexType.GeoHaystack,
  MongoIndexType.Hashed,
  MongoIndexType.Text,
]);

const SQL_IDENTIFIER_MAX_LEN = 63;

export type SqlIndexField = string | { name: string; order: 'ASC' | 'DESC' };

export function isCompatibleIndexType(value: unknown): value is CompatibleIndexType {
  return (
    value === CompatibleIndexType.Ascending || value === CompatibleIndexType.Descending
  );
}

export function isMongoIndexType(value: unknown): value is MongoIndexType {
  return MONGO_INDEX_TYPE_VALUES.has(value);
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
  return index.options?.unique === true || index.unique === true;
}

export type IndexIdentity = { fields: string[]; unique: boolean };

export function indexFieldNames(
  index: Pick<ModelOptionsIndexes, 'fields'> | { fields?: readonly unknown[] },
): string[] {
  return (index.fields ?? [])
    .map(field => {
      if (typeof field === 'string') return field;
      if (field && typeof field === 'object') {
        const obj = field as { name?: string; attribute?: string };
        if (typeof obj.name === 'string' && obj.name.length > 0) return obj.name;
        if (typeof obj.attribute === 'string' && obj.attribute.length > 0) {
          return obj.attribute;
        }
      }
      return '';
    })
    .filter(name => name.length > 0);
}

export function indexIdentity(index: ModelOptionsIndexes): IndexIdentity {
  return {
    fields: indexFieldNames(index),
    unique: isUniqueIndex(index),
  };
}

export function indexIdentitiesEqual(a: IndexIdentity, b: IndexIdentity): boolean {
  return (
    a.unique === b.unique &&
    a.fields.length === b.fields.length &&
    a.fields.every((field, i) => field === b.fields[i])
  );
}

export function indexIdentityKey(identity: IndexIdentity): string {
  return `${identity.unique ? 'u' : 'n'}:${identity.fields.join('\0')}`;
}

export function isSkippedLiveIndex(index: ModelOptionsIndexes): boolean {
  if (index.primary === true) return true;
  const name = resolveIndexName(index);
  return name === '_id_' || name === 'PRIMARY';
}

export function findLiveIndex(
  live: readonly ModelOptionsIndexes[],
  declared: ModelOptionsIndexes,
): ModelOptionsIndexes | undefined {
  const wanted = indexIdentity(declared);
  return live.find(
    row => !isSkippedLiveIndex(row) && indexIdentitiesEqual(indexIdentity(row), wanted),
  );
}

export function findIndexByName(
  indexes: readonly ModelOptionsIndexes[],
  name: string,
): ModelOptionsIndexes | undefined {
  return indexes.find(index => resolveIndexName(index) === name);
}

export function liveNameConflictAllowsReuse(
  declared: ModelOptionsIndexes,
  live: readonly ModelOptionsIndexes[],
): boolean {
  const name = resolveIndexName(declared);
  if (!name) return false;
  const row = findIndexByName(live, name);
  if (!row) return false;
  return indexIdentitiesEqual(indexIdentity(row), indexIdentity(declared));
}

export function indexNameCollection(schema: {
  collectionName?: string;
  name?: string;
}): string {
  if (schema.collectionName && schema.collectionName.length > 0) {
    return schema.collectionName;
  }
  return schema.name ?? '';
}

export function bindDeclaredIndexesToLive<T extends ModelOptionsIndexes>(
  declared: readonly T[],
  live: readonly ModelOptionsIndexes[],
  collectionName: string,
): T[] {
  return declared.map(index => {
    const match = findLiveIndex(live, index);
    if (match) {
      const name = resolveIndexName(match);
      if (name) {
        return {
          ...index,
          name,
          options: { ...index.options, name },
        };
      }
    }
    const fields = indexFieldNames(index);
    const stringFields = Array.isArray(index.fields)
      ? index.fields.every(field => typeof field === 'string')
      : false;
    if (stringFields && fields.length === index.fields.length) {
      return ensureIndexName(index, collectionName) as T;
    }
    return index;
  });
}

export function keepDeclaredIndexExtras(
  incomingBound: readonly ModelOptionsIndexes[],
  existingDb: readonly ModelOptionsIndexes[] | undefined,
  collectionName: string,
): ModelOptionsIndexes[] {
  const incoming = incomingBound.map(index => {
    const name = resolveIndexName(index);
    return name
      ? { ...index, name, options: { ...index.options, name } }
      : ensureIndexName(index, collectionName);
  });
  const incomingNames = new Set(
    incoming.map(resolveIndexName).filter((name): name is string => Boolean(name)),
  );
  const incomingIdentities = new Set(
    incoming.map(index => indexIdentityKey(indexIdentity(index))),
  );
  const extras: ModelOptionsIndexes[] = [];
  for (const index of existingDb ?? []) {
    const name = resolveIndexName(index);
    if (name && incomingNames.has(name)) continue;
    if (incomingIdentities.has(indexIdentityKey(indexIdentity(index)))) continue;
    extras.push(ensureIndexName(index, collectionName));
  }
  return [...incoming, ...extras];
}

export function overlayDeclaredOnLive(
  live: ModelOptionsIndexes,
  declared: readonly ModelOptionsIndexes[] | undefined,
): ModelOptionsIndexes {
  if (!declared?.length) return live;
  const name = resolveIndexName(live);
  const byName = name ? declaredIndexMap(declared).get(name) : undefined;
  const match = byName ?? findLiveIndex(declared, live);
  if (!match) return live;
  const liveName = name ?? resolveIndexName(match);
  return {
    ...live,
    types: match.types ?? live.types,
    options: { ...match.options, ...live.options, name: liveName },
  };
}

export function liveIndexFromMongo(index: {
  key?: Record<string, unknown>;
  name?: string;
  unique?: boolean;
}): ModelOptionsIndexes {
  return {
    name: index.name,
    fields: Object.keys(index.key ?? {}),
    options: { name: index.name, unique: !!index.unique },
  };
}

export function liveIndexFromSql(row: {
  name?: string;
  unique?: boolean;
  primary?: boolean;
  fields?: Array<string | { attribute?: string; name?: string }>;
}): ModelOptionsIndexes {
  return {
    name: row.name,
    fields: indexFieldNames({ fields: row.fields ?? [] }),
    options: { name: row.name, unique: !!row.unique },
    ...(row.primary ? { primary: true } : {}),
  };
}

export function normalizeIndexTypes(
  types: ModelOptionsIndexes['types'],
  fieldCount: number,
): unknown[] | undefined {
  if (types === undefined) return undefined;
  if (Array.isArray(types)) return [...types];
  return Array.from({ length: fieldCount }, () => types);
}

function typeToken(type: unknown): string {
  if (isPortableDirection(type) || type === undefined) {
    return mapCompatibleToSqlOrder(type).toLowerCase();
  }
  if (typeof type === 'string') return type.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return String(type);
}

function sanitizeIdentifierPart(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function generateIndexName(
  fields: readonly string[],
  types?: ModelOptionsIndexes['types'],
  unique = false,
  collectionName = '',
): string {
  const tokens = (
    normalizeIndexTypes(types, fields.length) ?? fields.map(() => undefined)
  )
    .map(typeToken)
    .join('_');
  const prefix = unique ? 'cnd_uidx' : 'cnd_idx';
  const table = sanitizeIdentifierPart(collectionName);
  const raw = `${prefix}_${table}_${fields.join('_')}_${tokens}`.replace(
    /[^A-Za-z0-9_]+/g,
    '_',
  );
  const sanitized = raw.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (sanitized.length <= SQL_IDENTIFIER_MAX_LEN) return sanitized;
  const identityKey = `${collectionName}\0${unique}\0${fields.join('\0')}\0${tokens}`;
  const hash = createHash('sha1').update(identityKey).digest('hex').slice(0, 8);
  const maxTableLen = SQL_IDENTIFIER_MAX_LEN - prefix.length - hash.length - 2;
  const tableSlice = table.slice(0, Math.max(1, maxTableLen));
  return `${prefix}_${tableSlice}_${hash}`.slice(0, SQL_IDENTIFIER_MAX_LEN);
}

export function ensureIndexName(
  index: ModelOptionsIndexes,
  collectionName: string,
): ModelOptionsIndexes {
  const existing = resolveIndexName(index);
  const name =
    existing ??
    generateIndexName(
      indexFieldNames(index),
      index.types,
      isUniqueIndex(index),
      collectionName,
    );
  return {
    ...index,
    name,
    options: { ...index.options, name },
  };
}

export function mapCompatibleToMongo(type: unknown): MongoIndexType {
  if (type === CompatibleIndexType.Descending || type === MongoIndexType.Descending) {
    return MongoIndexType.Descending;
  }
  if (
    type === undefined ||
    type === CompatibleIndexType.Ascending ||
    type === MongoIndexType.Ascending
  ) {
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
  return isPostgresIndexType(type) && dialect === 'postgres';
}

export function mongoAllowsIndexType(type: unknown): boolean {
  return type === undefined || isCompatibleIndexType(type) || isMongoIndexType(type);
}

export function mergeDeclaredIndexes(
  existing: readonly ModelOptionsIndexes[] | undefined,
  incoming: readonly ModelOptionsIndexes[],
  collectionName: string,
): ModelOptionsIndexes[] {
  const merged = declaredIndexMap(existing, collectionName);
  for (const index of incoming) {
    const named = ensureIndexName(index, collectionName);
    const name = resolveIndexName(named);
    if (name && !merged.has(name)) merged.set(name, named);
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
  if (args.privileged || args.schemaOwner === args.callerModule) return;
  throw new GrpcError(status.PERMISSION_DENIED, 'Not authorized to create unique index');
}

type ErrorPart = { code?: number | string; message?: string; name?: string };

function walkError(error: unknown): ErrorPart[] {
  const parts: ErrorPart[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const err = current as ErrorPart & {
      original?: unknown;
      parent?: unknown;
      cause?: unknown;
    };
    parts.push({ code: err.code, message: err.message, name: err.name });
    current = err.original ?? err.parent ?? err.cause;
  }
  return parts;
}

const UNIQUE_OR_OPTIONS_CONFLICT_CODES = new Set<number | string>([
  85,
  '85',
  86,
  '86',
  11000,
  '11000',
  23505,
  '23505',
  1062,
  '1062',
]);

export function isIndexKeySpecsConflictError(error: unknown): boolean {
  return walkError(error).some(part => part.code === 86 || part.code === '86');
}

export function isIndexAlreadyExistsError(error: unknown): boolean {
  const parts = walkError(error);
  if (parts.some(part => part.name === 'SequelizeUniqueConstraintError')) {
    return false;
  }
  if (
    parts.some(
      part => part.code !== undefined && UNIQUE_OR_OPTIONS_CONFLICT_CODES.has(part.code),
    )
  ) {
    return false;
  }
  for (const part of parts) {
    if (part.code === '42P07' || part.code === 1061 || part.code === '1061') {
      return true;
    }
    const message = part.message ?? '';
    if (/index .+ already exists/i.test(message)) return true;
    if (/duplicate key name/i.test(message)) return true;
    if (/relation .+ already exists/i.test(message)) return true;
  }
  return false;
}

export async function persistDeclaredSchemaIndexes(args: {
  declaredSchemaModel: {
    findOne: (
      query: Record<string, unknown>,
      options?: { readPreference?: string },
    ) => Promise<{
      _id: string;
      modelOptions?: { indexes?: ModelOptionsIndexes[] };
    } | null>;
    findByIdAndUpdate: (id: string, update: Record<string, unknown>) => Promise<unknown>;
  };
  schemaName: string;
  originalSchema: {
    modelOptions: { indexes?: ModelOptionsIndexes[] | readonly ModelOptionsIndexes[] };
    fields?: Record<string, unknown>;
    compiledFields?: Record<string, unknown>;
    collectionName?: string;
    name?: string;
  };
  applied?: ModelOptionsIndexes[];
  droppedNames?: string[];
}): Promise<boolean> {
  const found = await args.declaredSchemaModel.findOne(
    { name: args.schemaName },
    { readPreference: 'primary' },
  );
  const memoryIndexes = (args.originalSchema.modelOptions.indexes ??
    []) as ModelOptionsIndexes[];
  const dbIndexes = found?.modelOptions?.indexes ?? memoryIndexes;
  const collectionName = indexNameCollection(args.originalSchema) || args.schemaName;
  const next = args.droppedNames
    ? removeDeclaredIndexes(dbIndexes, args.droppedNames)
    : mergeDeclaredIndexes(dbIndexes, args.applied ?? [], collectionName);
  args.originalSchema.modelOptions.indexes = next;
  if (!found) return false;
  await args.declaredSchemaModel.findByIdAndUpdate(found._id, {
    modelOptions: args.originalSchema.modelOptions,
    fields: args.originalSchema.fields,
    compiledFields: args.originalSchema.compiledFields,
  });
  return true;
}

export function collectExistingIndexNames(
  indexes: readonly ModelOptionsIndexes[],
): Set<string> {
  return new Set(
    indexes.map(resolveIndexName).filter((name): name is string => Boolean(name)),
  );
}

export function declaredIndexMap(
  indexes: readonly ModelOptionsIndexes[] | undefined,
  collectionName = '',
): Map<string, ModelOptionsIndexes> {
  const map = new Map<string, ModelOptionsIndexes>();
  for (const index of indexes ?? []) {
    const named = ensureIndexName(index, collectionName);
    const name = resolveIndexName(named);
    if (name) map.set(name, named);
  }
  return map;
}

export function toMutableIndexes(
  indexes: readonly ModelOptionsIndexes[],
): ModelOptionsIndexes[] {
  return indexes.map(index => ({
    ...index,
    fields: [...index.fields],
    options: index.options ? { ...index.options } : index.options,
  }));
}

export function sqlIndexFields(index: ModelOptionsIndexes): SqlIndexField[] {
  const types = normalizeIndexTypes(index.types, index.fields.length);
  if (!types || !types.some(isPortableDirection)) {
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
  if (typeof row.type === 'string' && isPostgresIndexType(row.type.toUpperCase())) {
    return row.type.toUpperCase() as PostgresIndexType;
  }
  if (typeof row.definition === 'string') {
    const match = /USING\s+(\w+)/i.exec(row.definition);
    const using = match?.[1]?.toUpperCase();
    if (using && isPostgresIndexType(using)) return using;
  }
  if (['postgres', 'mysql', 'mariadb', 'sqlite'].includes(dialect)) {
    return PostgresIndexType.BTREE;
  }
  return undefined;
}

export function isMongoNamespaceMissingError(error: unknown): boolean {
  const err = error as { code?: number | string; codeName?: string; message?: string };
  if (err?.code === 26 || err?.code === '26' || err?.codeName === 'NamespaceNotFound') {
    return true;
  }
  return /ns does not exist|ns not found|namespace not found/i.test(err?.message ?? '');
}

export function isArrayLikeConduitField(field: unknown): boolean {
  if (Array.isArray(field)) return true;
  return Boolean(
    field &&
    typeof field === 'object' &&
    Array.isArray((field as { type?: unknown }).type),
  );
}

function isRelationElement(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'Relation',
  );
}

export function isExtractedArrayRelationField(field: unknown): boolean {
  if (Array.isArray(field)) return isRelationElement(field[0]);
  if (field && typeof field === 'object') {
    const type = (field as { type?: unknown }).type;
    if (Array.isArray(type)) return isRelationElement(type[0]);
  }
  return false;
}

export function isMysqlJsonLikeField(field: unknown): boolean {
  if (!field || typeof field !== 'object') return false;
  if (Array.isArray(field)) {
    const first = field[0];
    if (isRelationElement(first)) return false;
    if (typeof first === 'string') return first === 'JSON';
    return Boolean(first && typeof first === 'object');
  }
  const type = (field as { type?: unknown }).type;
  if (type === 'JSON') return true;
  return Array.isArray(type);
}

export function isScalarRelationField(field: unknown): boolean {
  return Boolean(
    field &&
    typeof field === 'object' &&
    !Array.isArray(field) &&
    (field as { type?: unknown }).type === 'Relation',
  );
}

export function sqlIndexUnsupportedReason(
  dialect: string,
  index: Pick<ModelOptionsIndexes, 'fields'>,
  fields: Record<string, unknown>,
  options?: { timestamps?: boolean },
): string | undefined {
  const present = new Set(Object.keys(fields));
  if (options?.timestamps) {
    present.add('createdAt');
    present.add('updatedAt');
  }
  const mysqlJson = dialect === 'mysql' || dialect === 'mariadb';
  for (const name of indexFieldNames(index)) {
    const field = fields[name];
    if (isExtractedArrayRelationField(field)) {
      return `Field '${name}' is stored as a relation join table and cannot be indexed on SQL`;
    }
    if (isScalarRelationField(field)) {
      return `Field '${name}' is a relation and cannot be indexed on SQL`;
    }
    if (mysqlJson && isMysqlJsonLikeField(field)) {
      return `Compatible btree indexes are not supported on MySQL JSON field '${name}'`;
    }
    if (field === undefined && !present.has(name)) {
      return `Field '${name}' is stored as a relation join table and cannot be indexed on SQL`;
    }
  }
  return undefined;
}
