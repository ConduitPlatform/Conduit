import {
  GrpcError,
  VectorIndexDefinition,
  VectorIndexMethod,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertVectorIndexContract,
  assertVectorIndexMatchesField,
  isObjectFormVectorField,
  VectorIndexProvider,
} from './vectorField.js';

export const MONGO_VECTOR_ID_FILTER_FIELD = '_id';

export interface PostgresCatalogIndex {
  indexname: string;
  tablename: string;
  indexdef: string;
}

export interface ParsedPostgresVectorIndex {
  name?: string;
  tableName?: string;
  field: string;
  method?: string;
  similarity: VectorSimilarity;
  options?: VectorIndexDefinition['options'];
}

export type PostgresVectorIndexCreatePlan =
  { action: 'create'; sql: string } | { action: 'reuse' };

export function defaultVectorIndexName(
  field: string,
  physicalTableName?: string,
): string {
  return physicalTableName ? `${physicalTableName}_${field}_vector` : `${field}_vector`;
}

export function vectorIndexGeneration(name?: string): number {
  if (typeof name !== 'string' || name.length === 0) return 0;
  const match = /_v(\d+)$/.exec(name);
  if (match) return Number(match[1]);
  return 1;
}

export function selectLiveVectorIndexForField<
  T extends { field?: string; name?: string },
>(indexes: readonly T[], field: string): T | undefined {
  const matches = indexes.filter(index => index.field === field);
  if (!matches.length) return undefined;
  const defaultName = defaultVectorIndexName(field);
  return matches.reduce((best, current) => {
    const bestGeneration = vectorIndexGeneration(best.name);
    const currentGeneration = vectorIndexGeneration(current.name);
    if (currentGeneration !== bestGeneration) {
      return currentGeneration > bestGeneration ? current : best;
    }
    if (current.name === defaultName) return current;
    if (best.name === defaultName) return best;
    return best;
  });
}

export function mongoVectorFilterFields(filterFields?: readonly string[]): string[] {
  const fields: string[] = [];
  for (const field of [MONGO_VECTOR_ID_FILTER_FIELD, ...(filterFields ?? [])]) {
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

export function bindVectorIndexToField(args: {
  provider: VectorIndexProvider;
  index: VectorIndexDefinition;
  field: unknown;
  physicalTableName?: string;
}): VectorIndexDefinition {
  const field = isObjectFormVectorField(args.field) ? args.field : undefined;
  const bound: VectorIndexDefinition = {
    ...args.index,
    name:
      args.index.name ?? defaultVectorIndexName(args.index.field, args.physicalTableName),
    dimensions: args.index.dimensions ?? field?.dimensions,
    similarity: args.index.similarity ?? field?.similarity,
    filterFields:
      args.provider === 'mongodb'
        ? mongoVectorFilterFields(args.index.filterFields)
        : args.index.filterFields,
  };
  assertVectorIndexContract(args.provider, bound);
  assertVectorIndexMatchesField(args.field, bound);
  return bound;
}

export function mongoSearchIndexReadiness(index: {
  status?: string;
  queryable?: boolean;
}): { status: VectorIndexStatus; queryable: boolean } {
  const raw = (index.status ?? '').toUpperCase();
  switch (raw) {
    case 'READY':
      return { status: VectorIndexStatus.Ready, queryable: true };
    case 'STALE':
      return {
        status: VectorIndexStatus.Ready,
        queryable: index.queryable !== false,
      };
    case 'FAILED':
    case 'DOES_NOT_EXIST':
      return { status: VectorIndexStatus.Failed, queryable: false };
    case 'PENDING':
    case 'BUILDING':
    case 'DELETING':
    case '':
      return {
        status: VectorIndexStatus.Pending,
        queryable: index.queryable === true,
      };
    default:
      if (index.queryable === true) {
        return { status: VectorIndexStatus.Ready, queryable: true };
      }
      return { status: VectorIndexStatus.Pending, queryable: false };
  }
}

export function isVectorIndexQueryable(index?: VectorIndexDefinition): boolean {
  if (!index) return false;
  if (index.queryable === false) return false;
  if (index.status === VectorIndexStatus.Failed) return false;
  if (index.status === VectorIndexStatus.Pending && index.queryable !== true) {
    return false;
  }
  if (index.queryable === true) return true;
  return index.status === VectorIndexStatus.Ready;
}

export function assertVectorIndexQueryable(
  index: VectorIndexDefinition | undefined,
  request: { field: string; indexName?: string },
): asserts index is VectorIndexDefinition {
  if (!index) {
    const named = request.indexName ? ` (index '${request.indexName}')` : '';
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `No vector index is available for field '${request.field}'${named}. ` +
        'Create the index and wait until it is ready before searching.',
    );
  }
  if (isVectorIndexQueryable(index)) return;
  const indexName = index.name ?? defaultVectorIndexName(index.field);
  const statusLabel = index.status ?? 'unknown';
  throw new GrpcError(
    status.FAILED_PRECONDITION,
    `Vector index '${indexName}' is not queryable (status: ${statusLabel}). ` +
      'Wait until the index is ready before searching.',
  );
}

export function vectorIndexesEquivalent(
  left: VectorIndexDefinition,
  right: VectorIndexDefinition,
  provider: VectorIndexProvider,
): boolean {
  if (left.field !== right.field) return false;
  if (left.dimensions !== right.dimensions) return false;
  if (left.similarity !== right.similarity) return false;
  const leftMethod = left.method ?? VectorIndexMethod.HNSW;
  const rightMethod = right.method ?? VectorIndexMethod.HNSW;
  if (leftMethod !== rightMethod) return false;
  if (provider === 'mongodb') {
    return sameStringSet(
      mongoVectorFilterFields(left.filterFields),
      mongoVectorFilterFields(right.filterFields),
    );
  }
  return true;
}

export function planMongoVectorIndexCreate(args: {
  requested: VectorIndexDefinition;
  existing: VectorIndexDefinition[];
}): { action: 'create' } | { action: 'reuse' } {
  const existing = args.existing.find(index => index.name === args.requested.name);
  if (!existing) return { action: 'create' };
  if (vectorIndexesEquivalent(args.requested, existing, 'mongodb')) {
    return { action: 'reuse' };
  }
  throw new GrpcError(
    status.FAILED_PRECONDITION,
    `Vector index '${args.requested.name}' already exists with a different definition. ` +
      'Drop it before recreating.',
  );
}

function postgresSimilarityFromOperator(operator?: string): VectorSimilarity {
  if (operator === 'l2' || operator === 'vector_l2_ops') {
    return VectorSimilarity.Euclidean;
  }
  if (operator === 'ip' || operator === 'vector_ip_ops') {
    return VectorSimilarity.DotProduct;
  }
  return VectorSimilarity.Cosine;
}

export function parsePostgresVectorIndexDef(indexdef: string): ParsedPostgresVectorIndex {
  const tableMatch = /ON\s+(?:(?:"[^"]+"|\w+)\.)?(?:"([^"]+)"|(\w+))/i.exec(indexdef);
  const method = /USING\s+(\w+)/i.exec(indexdef)?.[1]?.toLowerCase();
  const fieldMatch = /\((?:"([^"]+)"|(\w+))\s+vector_/i.exec(indexdef);
  const operator = /vector_(l2|cosine|ip)_ops/i.exec(indexdef)?.[1];
  const similarity = postgresSimilarityFromOperator(operator);
  return {
    tableName: tableMatch?.[1] ?? tableMatch?.[2],
    field: fieldMatch?.[1] ?? fieldMatch?.[2] ?? '',
    method,
    similarity,
    options: parsePostgresIndexOptions(indexdef, method),
  };
}

export function postgresVectorIndexDefinitionMatches(
  indexdef: string,
  expected: {
    tableName: string;
    field: string;
    method: string;
    operator: string;
    options?: VectorIndexDefinition['options'];
  },
): boolean {
  const parsed = parsePostgresVectorIndexDef(indexdef);
  if (parsed.tableName && parsed.tableName !== expected.tableName) return false;
  if (parsed.field !== expected.field) return false;
  if ((parsed.method ?? '').toLowerCase() !== expected.method.toLowerCase()) {
    return false;
  }
  if (parsed.similarity !== postgresSimilarityFromOperator(expected.operator)) {
    return false;
  }
  return postgresRequestedOptionsMatch(expected.options, parsed.options, expected.method);
}

export function planPostgresVectorIndexCreate(args: {
  indexName: string;
  tableName: string;
  field: string;
  method: string;
  operator: string;
  withOptions: string;
  existing?: PostgresCatalogIndex;
  quoteIdentifier: (identifier: string) => string;
}): PostgresVectorIndexCreatePlan {
  if (!args.existing) {
    return {
      action: 'create',
      sql: renderPostgresCreateVectorIndexSql(args),
    };
  }
  if (args.existing.tablename !== args.tableName) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Vector index name '${args.indexName}' already exists on table '${args.existing.tablename}'.`,
    );
  }
  if (!isPostgresVectorIndexDef(args.existing.indexdef)) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Index '${args.indexName}' exists on '${args.tableName}' but is not a vector index.`,
    );
  }
  if (
    !postgresVectorIndexDefinitionMatches(args.existing.indexdef, {
      tableName: args.tableName,
      field: args.field,
      method: args.method,
      operator: args.operator,
      options: withOptionsToDefinition(args.method, args.withOptions),
    })
  ) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Vector index '${args.indexName}' already exists on '${args.tableName}' with a different definition. ` +
        'Drop it before recreating.',
    );
  }
  return { action: 'reuse' };
}

export function renderPostgresCreateVectorIndexSql(args: {
  indexName: string;
  tableName: string;
  field: string;
  method: string;
  operator: string;
  withOptions: string;
  quoteIdentifier: (identifier: string) => string;
}): string {
  return (
    `CREATE INDEX ${args.quoteIdentifier(args.indexName)} ON ${args.quoteIdentifier(
      args.tableName,
    )} USING ${args.method} (${args.quoteIdentifier(args.field)} ${args.operator})` +
    args.withOptions
  );
}

export function assertPostgresVectorIndexDropTarget(args: {
  indexName: string;
  tableName: string;
  existing?: PostgresCatalogIndex;
}): PostgresCatalogIndex {
  if (!args.existing || args.existing.tablename !== args.tableName) {
    throw new GrpcError(
      status.NOT_FOUND,
      `Vector index '${args.indexName}' was not found on table '${args.tableName}'.`,
    );
  }
  if (!isPostgresVectorIndexDef(args.existing.indexdef)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Index '${args.indexName}' on '${args.tableName}' is not a vector index.`,
    );
  }
  return args.existing;
}

export function isMongoVectorSearchIndex(index?: {
  name?: string;
  type?: string;
}): boolean {
  return index?.type === 'vectorSearch';
}

export function assertMongoVectorSearchIndexDropTarget(args: {
  indexName: string;
  existing?: { name?: string; type?: string };
}): { name: string; type: 'vectorSearch' } {
  if (!args.existing) {
    throw new GrpcError(
      status.NOT_FOUND,
      `Vector search index '${args.indexName}' was not found.`,
    );
  }
  if (!isMongoVectorSearchIndex(args.existing)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Search index '${args.indexName}' is not a vectorSearch index.`,
    );
  }
  return {
    name: args.existing.name ?? args.indexName,
    type: 'vectorSearch',
  };
}

export function hydratePostgresVectorIndex(args: {
  name: string;
  indexdef: string;
  field?: { dimensions?: number; similarity?: VectorSimilarity };
  declared?: VectorIndexDefinition;
}): VectorIndexDefinition {
  const parsed = parsePostgresVectorIndexDef(args.indexdef);
  const method =
    (parsed.method as VectorIndexMethod | undefined) ?? args.declared?.method;
  return {
    name: args.name,
    field: parsed.field || args.declared?.field || '',
    dimensions: args.field?.dimensions ?? args.declared?.dimensions ?? 0,
    similarity: args.field?.similarity ?? parsed.similarity,
    method: method ?? VectorIndexMethod.HNSW,
    options: mergeVectorIndexOptions(args.declared?.options, parsed.options),
    status: VectorIndexStatus.Ready,
    queryable: true,
  };
}

export function isPostgresVectorIndexDef(indexdef: string): boolean {
  return /USING\s+(hnsw|ivfflat)\b/i.test(indexdef);
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every(value => rightSet.has(value));
}

function parsePostgresIndexOptions(
  indexdef: string,
  method?: string,
): VectorIndexDefinition['options'] | undefined {
  const match = /WITH\s*\(([^)]*)\)/i.exec(indexdef);
  if (!match) return undefined;
  const values: Record<string, number> = {};
  for (const part of match[1].split(',')) {
    const [rawKey, rawValue] = part.split('=').map(item => item.trim());
    if (!rawKey || rawValue === undefined) continue;
    const value = Number(rawValue.replace(/^['"]|['"]$/g, ''));
    if (!Number.isFinite(value)) continue;
    values[rawKey.toLowerCase()] = value;
  }
  if (method === 'ivfflat') {
    return values.lists !== undefined ? { ivfflat: { lists: values.lists } } : undefined;
  }
  const hnsw: NonNullable<VectorIndexDefinition['options']>['hnsw'] = {};
  if (values.m !== undefined) hnsw.m = values.m;
  if (values.ef_construction !== undefined) {
    hnsw.efConstruction = values.ef_construction;
  }
  return Object.keys(hnsw).length ? { hnsw } : undefined;
}

function withOptionsToDefinition(
  method: string,
  withOptions: string,
): VectorIndexDefinition['options'] | undefined {
  if (!withOptions.trim()) return undefined;
  return parsePostgresIndexOptions(` ${withOptions}`, method.toLowerCase());
}

function postgresRequestedOptionsMatch(
  requested: VectorIndexDefinition['options'] | undefined,
  actual: VectorIndexDefinition['options'] | undefined,
  method: string,
): boolean {
  if (method === 'ivfflat') {
    if (requested?.ivfflat?.lists === undefined) return true;
    return requested.ivfflat.lists === actual?.ivfflat?.lists;
  }
  if (requested?.hnsw?.m === undefined && requested?.hnsw?.efConstruction === undefined) {
    return true;
  }
  if (requested?.hnsw?.m !== undefined && requested.hnsw.m !== actual?.hnsw?.m) {
    return false;
  }
  if (
    requested?.hnsw?.efConstruction !== undefined &&
    requested.hnsw.efConstruction !== actual?.hnsw?.efConstruction
  ) {
    return false;
  }
  return true;
}

function mergeVectorIndexOptions(
  declared?: VectorIndexDefinition['options'],
  catalog?: VectorIndexDefinition['options'],
): VectorIndexDefinition['options'] | undefined {
  if (!declared && !catalog) return undefined;
  const hnsw = { ...declared?.hnsw, ...catalog?.hnsw };
  const ivfflat = { ...declared?.ivfflat, ...catalog?.ivfflat };
  const merged: VectorIndexDefinition['options'] = {
    ...declared,
    ...catalog,
  };
  if (Object.keys(hnsw).length) merged.hnsw = hnsw;
  else delete merged.hnsw;
  if (Object.keys(ivfflat).length) merged.ivfflat = ivfflat;
  else delete merged.ivfflat;
  return Object.values(merged).some(value => value !== undefined) ? merged : undefined;
}
