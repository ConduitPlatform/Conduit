import {
  Indexable,
  VectorIndexDefinition,
  VectorSearchInput,
  VectorSearchProvider,
  VectorSearchResult,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { clampVectorSearchLimits } from './vectorSearchLimits.js';
import { validateVectorSearchFilter } from './vectorSearchFilter.js';
import { renderPostgresVectorWhere, PostgresWhereRenderer } from './vectorSearchWhere.js';
import { pgVectorDistanceOperator } from './vectorMappings.js';
import { mongoVectorProjection, postgresVectorSelectList } from './vectorProjection.js';
import {
  applyBoundedVectorAuthorization,
  authorizeBoundedVectorCandidates,
} from './vectorSearchAuth.js';
import {
  normalizeVectorSearchScore,
  stripVectorScoreField,
  toVectorSearchResult,
} from './vectorScore.js';
import { parseVectorSimilarity } from './vectorField.js';
import {
  assertVectorIndexQueryable,
  defaultVectorIndexName,
} from './vectorIndexLifecycle.js';

export interface PlannedMongoVectorSearch {
  emptyResult: boolean;
  limits: { limit: number; numCandidates: number };
  index?: VectorIndexDefinition;
  pipeline: Indexable[];
}

export interface PlannedPostgresVectorSearch {
  emptyResult: boolean;
  limits: { limit: number; numCandidates: number };
  index?: VectorIndexDefinition;
  sql: string;
  distanceOperator: string;
}

export function schemaFieldNames(schemaFields: Record<string, unknown>): string[] {
  const fields = Object.keys(schemaFields);
  if (!fields.includes('_id')) {
    fields.unshift('_id');
  }
  return fields;
}

export function declaredVectorIndexes(schema: {
  modelOptions?: { vectorIndexes?: ReadonlyArray<VectorIndexDefinition> };
}): VectorIndexDefinition[] {
  return [...(schema.modelOptions?.vectorIndexes ?? [])];
}

export function findVectorIndexForSearch(
  indexes: VectorIndexDefinition[],
  request: { indexName?: string; field: string },
): VectorIndexDefinition | undefined {
  if (request.indexName) {
    return indexes.find(item => item.name === request.indexName);
  }
  return (
    indexes.find(
      item =>
        item.field === request.field &&
        item.name === defaultVectorIndexName(request.field),
    ) ?? indexes.find(item => item.field === request.field)
  );
}

export function mergeVectorIndexes(
  declared: VectorIndexDefinition[],
  live: VectorIndexDefinition[],
): VectorIndexDefinition[] {
  if (!live.length) return declared;
  if (!declared.length) return live;
  const merged = new Map<string, VectorIndexDefinition>();
  for (const index of declared) {
    merged.set(index.name ?? defaultVectorIndexName(index.field), index);
  }
  for (const index of live) {
    merged.set(index.name ?? defaultVectorIndexName(index.field), index);
  }
  return [...merged.values()];
}

export function buildMongoVectorSearchPipeline(args: {
  indexName: string;
  field: string;
  vector: number[];
  numCandidates: number;
  limit: number;
  filter?: Indexable;
  projection: Indexable;
}): Indexable[] {
  const vectorStage: Indexable = {
    index: args.indexName,
    path: args.field,
    queryVector: args.vector,
    numCandidates: args.numCandidates,
    limit: args.limit,
  };
  if (args.filter && Object.keys(args.filter).length > 0) {
    vectorStage.filter = args.filter;
  }
  return [
    { $vectorSearch: vectorStage },
    { $addFields: { _score: { $meta: 'vectorSearchScore' } } },
    { $project: args.projection },
  ];
}

export function planMongoVectorSearch(args: {
  request: VectorSearchInput;
  indexes: VectorIndexDefinition[];
  schemaFields: Record<string, unknown>;
}): PlannedMongoVectorSearch {
  const limits = clampVectorSearchLimits({
    limit: args.request.limit,
    numCandidates: args.request.numCandidates,
  });
  const index = findVectorIndexForSearch(args.indexes, args.request);
  const validated = validateVectorSearchFilter(args.request.filter, {
    provider: 'mongodb',
    allowedFilterFields: index?.filterFields ?? [],
  });
  if (validated.emptyResult) {
    return { emptyResult: true, limits, index, pipeline: [] };
  }
  assertVectorIndexQueryable(index, args.request);
  return {
    emptyResult: false,
    limits,
    index,
    pipeline: buildMongoVectorSearchPipeline({
      indexName:
        args.request.indexName ??
        index.name ??
        defaultVectorIndexName(args.request.field),
      field: args.request.field,
      vector: args.request.vector,
      numCandidates: limits.numCandidates,
      limit: limits.numCandidates,
      filter: validated.filter,
      projection: mongoVectorProjection(args.schemaFields, args.request.select),
    }),
  };
}

export function planPostgresVectorSearch(args: {
  request: VectorSearchInput;
  indexes: VectorIndexDefinition[];
  schemaFields: Record<string, unknown>;
  tableName: string;
  similarity: VectorSimilarity | string | undefined;
  renderer: PostgresWhereRenderer;
}): PlannedPostgresVectorSearch {
  const limits = clampVectorSearchLimits({
    limit: args.request.limit,
    numCandidates: args.request.numCandidates,
  });
  const index = findVectorIndexForSearch(args.indexes, args.request);
  const validated = validateVectorSearchFilter(args.request.filter, {
    provider: 'postgres',
    allowedFilterFields: schemaFieldNames(args.schemaFields),
  });
  const distanceOperator = pgVectorDistanceOperator(
    parseVectorSimilarity(args.similarity),
  );
  if (validated.emptyResult) {
    return { emptyResult: true, limits, index, sql: '', distanceOperator };
  }
  assertVectorIndexQueryable(index, args.request);
  const where = renderPostgresVectorWhere(validated.filter, args.renderer);
  const selectedColumns = postgresVectorSelectList(
    args.schemaFields,
    args.request.select,
    args.renderer.quoteIdentifier,
  );
  const vectorLiteral = args.renderer.escape(`[${args.request.vector.join(',')}]`);
  const fieldSql = args.renderer.quoteIdentifier(args.request.field);
  const sql =
    `SELECT ${selectedColumns}, (${fieldSql} ${distanceOperator} ${vectorLiteral}::vector) AS _score ` +
    `FROM ${args.renderer.quoteIdentifier(args.tableName)}${where} ` +
    `ORDER BY ${fieldSql} ${distanceOperator} ${vectorLiteral}::vector ` +
    `LIMIT ${limits.numCandidates}`;
  return { emptyResult: false, limits, index, sql, distanceOperator };
}

export async function completeVectorSearch<T extends Indexable>(args: {
  emptyResult: boolean;
  limit: number;
  authzEnabled: boolean;
  adminOperator?: boolean;
  provider: VectorSearchProvider;
  metric: VectorSimilarity | string | undefined;
  fetchCandidates: () => Promise<T[]>;
  lookupAuthorizedIds: (ids: string[]) => Promise<string[]>;
}): Promise<VectorSearchResult<T>[]> {
  if (args.emptyResult) return [];
  const documents = await args.fetchCandidates();
  const authorizedIds = await authorizeBoundedVectorCandidates({
    authzEnabled: args.authzEnabled,
    adminOperator: args.adminOperator,
    candidateIds: documents
      .map(document => document._id ?? document.id)
      .filter((id): id is string | { toString(): string } => id != null),
    lookupAuthorizedIds: args.lookupAuthorizedIds,
  });
  const allowed = applyBoundedVectorAuthorization(documents, authorizedIds, args.limit);
  return allowed.map(document => {
    const normalized = normalizeVectorSearchScore({
      provider: args.provider,
      metric: args.metric,
      raw: document._score,
    });
    return toVectorSearchResult(stripVectorScoreField(document), normalized);
  });
}
