import { createHash } from 'node:crypto';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { parseJsonObject } from './protoMappers.js';
import { sanitizeErrorMessage } from './redactConfig.js';
import {
  EMBEDDING_DOCUMENT_SCHEMA,
  EMBEDDING_SOURCE_KINDS,
  CHUNK_FILTER_FIELDS,
  CHUNK_VECTOR_FIELD,
  PERSISTED_CHUNK_FIELDS,
  assertVectorProfile,
  modelFingerprint,
  toPersistedChunk,
  type EmbeddingSourceKind,
  type EmbeddingSourceState,
  type VectorProfile,
} from './genericSource.js';
import type { Config } from '../config/index.js';

export const DEFAULT_TRUSTED_INGEST_MODULES = [
  'database',
  'core',
  'storage',
  'embeddings',
] as const;
export const SOURCE_OPERATOR_MODULES = ['database', 'core'] as const;

export const DEFAULT_MAX_INGEST_BATCH = 100;
export const DEFAULT_MAX_CHUNKS_PER_DOCUMENT = 256;
export const DEFAULT_MAX_METADATA_BYTES = 4 * 1024;
export const DEFAULT_MAX_REFERENCE_BYTES = 1024;
export const SOURCE_SEARCH_MAX_LIMIT = 100;

export const HIDDEN_CHUNK_RESULT_FIELDS = [
  CHUNK_VECTOR_FIELD,
  'contentHash',
  'modelFingerprint',
  'sourceLocator',
  'partitionSubject',
] as const;

const PARTITION_SUBJECT = /^[A-Za-z][A-Za-z0-9_]*:[A-Za-z0-9._:-]{1,128}$/;
const EXTERNAL_DOCUMENT_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const CHUNK_KEY = /^[A-Za-z0-9._:-]{1,128}$/;
const ALLOWED_SOURCE_FILTER_FIELDS = new Set<string>(CHUNK_FILTER_FIELDS);

export interface IngestLimits {
  trustedIngestModules: string[];
  maxIngestBatchSize: number;
  maxChunksPerDocument: number;
  maxChunkTextBytes: number;
  maxMetadataBytes: number;
  maxReferenceBytes: number;
  sourceSearchMaxLimit: number;
}

export interface IngestChunkInput {
  chunkKey?: string;
  ordinal?: number;
  text?: string;
  vector?: number[];
  metadata?: string | Record<string, unknown>;
}

export type IngestItemStatus = 'indexed' | 'skipped' | 'failed' | 'retry';

export interface PreparedChunk {
  chunkKey: string;
  ordinal: number;
  embedding: number[];
  contentHash: string;
  metadata?: Record<string, unknown>;
  status: IngestItemStatus;
}

export function ingestLimits(config?: Config): IngestLimits {
  const security = (config?.security ?? {}) as Partial<IngestLimits> & {
    maxEmbedInputBytes?: number;
  };
  return {
    trustedIngestModules: security.trustedIngestModules ?? [
      ...DEFAULT_TRUSTED_INGEST_MODULES,
    ],
    maxIngestBatchSize: security.maxIngestBatchSize ?? DEFAULT_MAX_INGEST_BATCH,
    maxChunksPerDocument:
      security.maxChunksPerDocument ?? DEFAULT_MAX_CHUNKS_PER_DOCUMENT,
    maxChunkTextBytes:
      security.maxChunkTextBytes ?? security.maxEmbedInputBytes ?? 32 * 1024,
    maxMetadataBytes: security.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES,
    maxReferenceBytes: security.maxReferenceBytes ?? DEFAULT_MAX_REFERENCE_BYTES,
    sourceSearchMaxLimit: security.sourceSearchMaxLimit ?? SOURCE_SEARCH_MAX_LIMIT,
  };
}

export function assertCanManageSources(args: {
  callerModule?: string;
  platformAdmin?: boolean;
}): void {
  if (args.platformAdmin) return;
  if (args.callerModule && SOURCE_OPERATOR_MODULES.includes(args.callerModule as never)) {
    return;
  }
  throw new GrpcError(
    status.PERMISSION_DENIED,
    `Module '${args.callerModule ?? 'unknown'}' is not allowed to manage embedding sources`,
  );
}

export function assertTrustedIngest(args: {
  callerModule?: string;
  platformAdmin?: boolean;
  trustedModules?: string[];
}): void {
  if (args.platformAdmin) return;
  const allowlist = args.trustedModules ?? [...DEFAULT_TRUSTED_INGEST_MODULES];
  if (args.callerModule && allowlist.includes(args.callerModule)) return;
  throw new GrpcError(
    status.PERMISSION_DENIED,
    `Module '${args.callerModule ?? 'unknown'}' is not allowed to ingest embedding documents`,
  );
}

export function assertSourceKind(kind?: string): EmbeddingSourceKind {
  if (!kind || !EMBEDDING_SOURCE_KINDS.includes(kind as EmbeddingSourceKind)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `kind must be one of ${EMBEDDING_SOURCE_KINDS.join(', ')}`,
    );
  }
  return kind as EmbeddingSourceKind;
}

export function assertPartitionSubject(value?: string): string {
  const partition = value?.trim() ?? '';
  if (!PARTITION_SUBJECT.test(partition)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'partitionSubject must be a resource reference such as Team:id',
    );
  }
  return partition;
}

export function assertExternalDocumentId(value?: string): string {
  const id = value?.trim() ?? '';
  if (!EXTERNAL_DOCUMENT_ID.test(id)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'externalDocumentId is invalid');
  }
  return id;
}

export function assertChunkKey(value?: string): string {
  const key = value?.trim() ?? '';
  if (!CHUNK_KEY.test(key)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'chunkKey is invalid');
  }
  return key;
}

export function assertSourceState(
  state: string | undefined,
  allowed: readonly EmbeddingSourceState[],
  message: string,
): void {
  if (!state || !allowed.includes(state as EmbeddingSourceState)) {
    throw new GrpcError(status.FAILED_PRECONDITION, message);
  }
}

export function assertSourceWritable(state?: string): void {
  assertSourceState(state, ['ready'], 'Embedding source is not ready for ingest');
}

export function assertSourceSearchable(state?: string): void {
  assertSourceState(state, ['ready'], 'Embedding source is not available for search');
}

export function assertImmutableProfile(
  existing: VectorProfile & { kind: string; partitionSubject: string },
  next: Partial<VectorProfile> & { kind?: string; partitionSubject?: string },
): void {
  if (next.kind != null && next.kind !== existing.kind) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'Embedding source kind is immutable');
  }
  if (
    next.partitionSubject != null &&
    next.partitionSubject !== existing.partitionSubject
  ) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'Embedding source partitionSubject is immutable',
    );
  }
  if (next.provider != null && next.provider !== existing.provider) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'Embedding source profile is immutable',
    );
  }
  if (next.modelName != null && next.modelName !== existing.modelName) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'Embedding source profile is immutable',
    );
  }
  if (next.dimensions != null && next.dimensions !== existing.dimensions) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'Embedding source profile is immutable',
    );
  }
  if (next.similarity != null && next.similarity !== existing.similarity) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      'Embedding source profile is immutable',
    );
  }
}

export function assertFiniteVector(
  vector: unknown,
  dimensions: number,
  label = 'vector',
): number[] {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `${label} must be a non-empty number array`,
    );
  }
  if (vector.length !== dimensions) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `${label} must have exactly ${dimensions} dimensions`,
    );
  }
  const values = vector.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `${label}[${index}] must be a finite number`,
      );
    }
    return value;
  });
  return values;
}

export function assertXorTextOrVector(chunk: IngestChunkInput): {
  text?: string;
  vector?: number[];
} {
  const text = typeof chunk.text === 'string' ? chunk.text : undefined;
  const hasText = text != null && text.length > 0;
  const hasVector = Array.isArray(chunk.vector) && chunk.vector.length > 0;
  if (hasText === hasVector) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Each chunk must include exactly one of text or vector',
    );
  }
  return hasText ? { text } : { vector: chunk.vector };
}

export function assertBoundedBytes(value: string, maxBytes: number, field: string): void {
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > maxBytes) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `${field} exceeds the ${maxBytes} byte limit`,
    );
  }
}

export function parseBoundedObject(
  value: string | Record<string, unknown> | undefined,
  field: string,
  maxBytes: number,
): Record<string, unknown> | undefined {
  if (value == null || value === '') return undefined;
  const parsed = typeof value === 'string' ? parseJsonObject(value, field) : value;
  if (!parsed) return undefined;
  assertBoundedBytes(JSON.stringify(parsed), maxBytes, field);
  for (const key of Object.keys(parsed)) {
    if (/(api[_-]?key|token|secret|password|credential)/i.test(key)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `${field} must not include credential field '${key}'`,
      );
    }
  }
  return parsed;
}

export function assertBoundedReference(
  value: string | undefined,
  maxBytes: number,
  field: string,
) {
  if (value == null || value === '') return undefined;
  assertBoundedBytes(value, maxBytes, field);
  return value;
}

export function assertIngestBatch(
  chunks: IngestChunkInput[],
  limits: IngestLimits,
): void {
  if (!chunks.length) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'At least one chunk is required');
  }
  if (
    chunks.length > limits.maxIngestBatchSize ||
    chunks.length > limits.maxChunksPerDocument
  ) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Chunk batch exceeds the limit of ${Math.min(limits.maxIngestBatchSize, limits.maxChunksPerDocument)}`,
    );
  }
}

export function hashChunkContent(
  profile: VectorProfile,
  payload: string | number[],
): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return createHash('sha256')
    .update(`${modelFingerprint(profile)}\n${body}`)
    .digest('hex');
}

export function classifyIngestError(err: unknown): IngestItemStatus {
  if (err instanceof GrpcError) {
    if (err.code === status.UNAVAILABLE || err.code === status.DEADLINE_EXCEEDED) {
      return 'retry';
    }
  }
  return 'failed';
}

export function ingestErrorMessage(err: unknown): string {
  const message = sanitizeErrorMessage(err);
  return message || 'Chunk ingest failed';
}

export function sourceSearchFilter(args: {
  sourceId: string;
  partitionSubject: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    sourceId: args.sourceId,
    partitionSubject: args.partitionSubject,
    status: 'indexed',
  };
  if (!args.extra) return filter;
  for (const [key, value] of Object.entries(args.extra)) {
    if (key === 'partitionSubject' || key === 'sourceId') {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Source search cannot override partition or source filters',
      );
    }
    if (!ALLOWED_SOURCE_FILTER_FIELDS.has(key)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `Source search filter field '${key}' is not allowed`,
      );
    }
    if (value !== undefined) filter[key] = value;
  }
  return filter;
}

export function sanitizeSourceSearchDocument(args: {
  hit: Record<string, unknown>;
  document?: {
    externalDocumentId?: string;
    storageFileId?: string;
    connectorReference?: string;
    metadata?: Record<string, unknown>;
  };
  metadataAllowlist?: string[];
}): Record<string, unknown> {
  const allowlist = new Set(args.metadataAllowlist ?? []);
  const rawMetadata =
    args.document?.metadata ?? (args.hit.metadata as Record<string, unknown> | undefined);
  const metadata =
    rawMetadata && allowlist.size
      ? Object.fromEntries(
          Object.entries(rawMetadata).filter(([key]) => allowlist.has(key)),
        )
      : rawMetadata && !allowlist.size
        ? {}
        : undefined;
  const safe: Record<string, unknown> = {
    sourceId: args.hit.sourceId,
    documentId: args.hit.documentId,
    chunkKey: args.hit.chunkKey,
    ordinal: args.hit.ordinal,
    ...(typeof args.hit.mimeType === 'string' ? { mimeType: args.hit.mimeType } : {}),
    ...(args.document?.externalDocumentId
      ? { externalDocumentId: args.document.externalDocumentId }
      : {}),
    ...(args.document?.storageFileId
      ? { storageFileId: args.document.storageFileId }
      : {}),
    ...(args.document?.connectorReference
      ? { connectorReference: args.document.connectorReference }
      : {}),
    ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
  };
  for (const field of HIDDEN_CHUNK_RESULT_FIELDS) {
    delete safe[field];
  }
  for (const field of PERSISTED_CHUNK_FIELDS) {
    if (
      field !== 'sourceId' &&
      field !== 'documentId' &&
      field !== 'chunkKey' &&
      field !== 'ordinal' &&
      field !== 'mimeType' &&
      field !== 'metadata'
    ) {
      delete safe[field];
    }
  }
  return safe;
}

export function resourceRef(schemaName: string, id: string): string {
  return `${schemaName}:${id}`;
}

export function documentResource(id: string): string {
  return resourceRef(EMBEDDING_DOCUMENT_SCHEMA, id);
}

export function userSubject(userId: string): string {
  return `User:${userId}`;
}

export function assertClientSourceSearchRequest(request: {
  queryVector?: number[];
  userId?: string;
  adminOperator?: boolean;
  filter?: Record<string, unknown>;
  callerModule?: string;
}): void {
  if (request.callerModule !== 'router') return;
  if (request.queryVector?.length) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Client source search accepts query text only',
    );
  }
  if (request.adminOperator) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Client search cannot request admin operator context',
    );
  }
}

export { assertVectorProfile };
