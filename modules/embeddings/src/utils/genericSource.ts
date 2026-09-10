import { createHash } from 'node:crypto';
import {
  ConduitModel,
  ConduitSchema,
  GrpcError,
  TYPE,
  VectorIndexMethod,
  VectorSimilarity,
  type ConduitSchemaOptions,
  type VectorIndexDefinition,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  defaultEmbeddingVectorIndexName,
  nextEmbeddingVectorIndexName,
  selectEmbeddingVectorIndex,
  type EmbeddingVectorIndexShape,
} from './configChange.js';

export const EMBEDDING_SOURCE_SCHEMA = 'EmbeddingSource';
export const EMBEDDING_DOCUMENT_SCHEMA = 'EmbeddingDocument';
export const EMBEDDING_CHUNK_SCHEMA_PREFIX = '_ec_';
export const LEGACY_EMBEDDING_CHUNK_SCHEMA_PREFIX = '_EmbeddingChunk_';
export const CHUNK_SCHEMA_HASH_LENGTH = 20;
export const POSTGRES_NAMEDATALEN = 63;
export const CHUNK_VECTOR_FIELD = 'embedding';

const CHUNK_POSTGRES_SUFFIXES = [
  '_pkey',
  '_documentId_chunkKey',
  '_partitionSubject_sourceId',
  '_sourceId_documentId',
  '_mimeType_status',
  '_embedding_vector',
  '_embedding_vector_v2',
] as const;

export const EMBEDDING_SOURCE_KINDS = ['conduit-storage', 'external'] as const;
export type EmbeddingSourceKind = (typeof EMBEDDING_SOURCE_KINDS)[number];

export const EMBEDDING_SOURCE_STATES = [
  'pending',
  'ready',
  'disabled',
  'revoked',
  'failed',
] as const;
export type EmbeddingSourceState = (typeof EMBEDDING_SOURCE_STATES)[number];

export const EMBEDDING_DOCUMENT_STATES = [
  'pending',
  'queued',
  'extracting',
  'indexed',
  'skipped',
  'failed',
  'stale',
  'deleted',
] as const;
export type EmbeddingDocumentState = (typeof EMBEDDING_DOCUMENT_STATES)[number];

export const CHUNK_FILTER_FIELDS = [
  'partitionSubject',
  'sourceId',
  'documentId',
  'mimeType',
  'status',
] as const;

export const PERSISTED_CHUNK_FIELDS = [
  'documentId',
  'sourceId',
  'chunkKey',
  'ordinal',
  'embedding',
  'contentHash',
  'metadata',
  'sourceLocator',
  'partitionSubject',
  'modelFingerprint',
  'mimeType',
  'status',
] as const;

const FORBIDDEN_TEXT_FIELDS = new Set(['text', 'content', 'excerpt', 'body']);

const CREDENTIAL_FIELDS = new Set([
  'apikey',
  'token',
  'secret',
  'password',
  'credential',
  'credentials',
  'clientsecret',
  'refreshtoken',
  'accesstoken',
]);

export interface VectorProfile {
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: VectorSimilarity;
}

export interface BackingIndexState {
  schemaName: string;
  indexName: string;
  created: boolean;
}

export interface ChunkSchemaStore {
  createSchemaFromAdapter: (schema: ConduitSchema) => Promise<unknown>;
  migrate?: (schemaName: string) => Promise<unknown>;
  getVectorIndexes: (schemaName: string) => Promise<EmbeddingVectorIndexShape[]>;
  createVectorIndex: (
    schemaName: string,
    index: VectorIndexDefinition,
  ) => Promise<unknown>;
}

export interface GenericSourceProfile {
  _id: string;
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: string;
  chunkSchemaName?: string;
  chunkIndexName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hashFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isForbiddenPersistedTextField(field: string): boolean {
  return FORBIDDEN_TEXT_FIELDS.has(field.toLowerCase());
}

function isCredentialFieldName(field: string): boolean {
  return CREDENTIAL_FIELDS.has(field.toLowerCase().replace(/[-_]/g, ''));
}

function collectModelFieldNames(model: ConduitModel, prefix = ''): string[] {
  const names: string[] = [];
  for (const [key, definition] of Object.entries(model)) {
    const path = prefix ? `${prefix}.${key}` : key;
    names.push(path);
    if (isRecord(definition) && !('type' in definition) && !Array.isArray(definition)) {
      names.push(...collectModelFieldNames(definition as ConduitModel, path));
    }
  }
  return names;
}

export function assertNoPersistedTextFields(model: ConduitModel, label: string): void {
  for (const field of collectModelFieldNames(model)) {
    const leaf = field.split('.').pop() ?? field;
    if (isForbiddenPersistedTextField(leaf)) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `${label} must not persist text field '${field}'`,
      );
    }
  }
}

export function assertNoCredentialFields(model: ConduitModel, label: string): void {
  for (const field of collectModelFieldNames(model)) {
    const leaf = field.split('.').pop() ?? field;
    if (isCredentialFieldName(leaf)) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `${label} must not persist credential field '${field}'`,
      );
    }
  }
}

export function assertVectorProfile(profile: {
  provider?: string;
  modelName?: string;
  dimensions?: number;
  similarity?: string;
}): VectorProfile {
  const provider = profile.provider?.trim() ?? '';
  const modelName = profile.modelName?.trim() ?? '';
  if (!provider || !modelName) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embedding source profile requires provider and modelName',
    );
  }
  if (
    typeof profile.dimensions !== 'number' ||
    !Number.isInteger(profile.dimensions) ||
    profile.dimensions <= 0
  ) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Embedding source profile dimensions must be a positive integer',
    );
  }
  const similarity = profile.similarity || VectorSimilarity.Cosine;
  if (!Object.values(VectorSimilarity).includes(similarity as VectorSimilarity)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Unsupported similarity '${similarity}'`,
    );
  }
  return {
    provider,
    modelName,
    dimensions: profile.dimensions,
    similarity: similarity as VectorSimilarity,
  };
}

export function vectorProfileFingerprint(profile: VectorProfile): string {
  return JSON.stringify({
    provider: profile.provider,
    model: profile.modelName,
    dimensions: profile.dimensions,
    similarity: profile.similarity,
  });
}

export function modelFingerprint(profile: VectorProfile): string {
  return hashFingerprint(vectorProfileFingerprint(profile));
}

export function chunkSchemaNameForProfile(profile: VectorProfile): string {
  return `${EMBEDDING_CHUNK_SCHEMA_PREFIX}${modelFingerprint(profile).slice(
    0,
    CHUNK_SCHEMA_HASH_LENGTH,
  )}`;
}

export function legacyChunkSchemaNameForProfile(profile: VectorProfile): string {
  return `${LEGACY_EMBEDDING_CHUNK_SCHEMA_PREFIX}${modelFingerprint(profile)}`;
}

export function isEmbeddingChunkSchema(name: string): boolean {
  return (
    name.startsWith(EMBEDDING_CHUNK_SCHEMA_PREFIX) ||
    name.startsWith(LEGACY_EMBEDDING_CHUNK_SCHEMA_PREFIX)
  );
}

export function resolveChunkSchemaName(
  profile: VectorProfile,
  existingSchemaName?: string,
): string {
  if (existingSchemaName && isEmbeddingChunkSchema(existingSchemaName)) {
    return existingSchemaName;
  }
  return chunkSchemaNameForProfile(profile);
}

export function conduitPhysicalCollectionName(schemaName: string): string {
  return schemaName.startsWith('_') ? `cnd${schemaName}` : `cnd_${schemaName}`;
}

export function sequelizeUnderscore(name: string): string {
  return name.replace(/([A-Z])/g, '_$1').toLowerCase();
}

export function postgresIdentifier(name: string): string {
  return Buffer.from(name.toLowerCase(), 'utf8')
    .subarray(0, POSTGRES_NAMEDATALEN)
    .toString('utf8');
}

export function postgresQuotedIdentifier(name: string): string {
  return Buffer.from(name, 'utf8').subarray(0, POSTGRES_NAMEDATALEN).toString('utf8');
}

export function chunkSchemaPostgresRelations(schemaName: string): string[] {
  const table = conduitPhysicalCollectionName(schemaName);
  return [table, ...CHUNK_POSTGRES_SUFFIXES.map(suffix => `${table}${suffix}`)];
}

export function chunkVectorIndexDefinition(
  profile: VectorProfile,
): VectorIndexDefinition {
  return {
    field: CHUNK_VECTOR_FIELD,
    name: defaultEmbeddingVectorIndexName(CHUNK_VECTOR_FIELD),
    dimensions: profile.dimensions,
    similarity: profile.similarity,
    method: VectorIndexMethod.HNSW,
    filterFields: [...CHUNK_FILTER_FIELDS],
  };
}

function hiddenChunkModelOptions(profile: VectorProfile): ConduitSchemaOptions {
  return {
    timestamps: true,
    indexes: [
      { fields: ['documentId', 'chunkKey'], options: { unique: true } },
      { fields: ['partitionSubject', 'sourceId'] },
      { fields: ['sourceId', 'documentId'] },
      { fields: ['mimeType', 'status'] },
    ],
    vectorIndexes: [chunkVectorIndexDefinition(profile)],
    conduit: {
      cms: { enabled: false },
      permissions: {
        extendable: false,
        canCreate: false,
        canModify: 'Nothing',
        canDelete: false,
      },
      authorization: { enabled: false },
    },
  };
}

function chunkBackingFields(profile: VectorProfile): ConduitModel {
  return {
    _id: TYPE.ObjectId,
    documentId: { type: TYPE.String, required: true },
    sourceId: { type: TYPE.String, required: true },
    chunkKey: { type: TYPE.String, required: true },
    ordinal: { type: TYPE.Number, required: true },
    [CHUNK_VECTOR_FIELD]: {
      type: TYPE.Vector,
      dimensions: profile.dimensions,
      similarity: profile.similarity,
      required: true,
      select: false,
    },
    contentHash: { type: TYPE.String, required: true },
    metadata: { type: TYPE.JSON, required: false },
    sourceLocator: { type: TYPE.String, required: false },
    partitionSubject: { type: TYPE.String, required: true },
    modelFingerprint: { type: TYPE.String, required: true },
    mimeType: { type: TYPE.String, required: false },
    status: {
      type: TYPE.String,
      enum: [...EMBEDDING_DOCUMENT_STATES],
      required: true,
      default: 'pending',
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  };
}

export function assertChunkSchemaContract(schema: ConduitSchema): void {
  if (!isEmbeddingChunkSchema(schema.name)) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Chunk schema '${schema.name}' must use the hidden ${EMBEDDING_CHUNK_SCHEMA_PREFIX} prefix`,
    );
  }
  if (schema.modelOptions.conduit?.cms?.enabled !== false) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Chunk schema '${schema.name}' must disable CMS`,
    );
  }
  if (schema.modelOptions.conduit?.authorization?.enabled === true) {
    throw new GrpcError(
      status.FAILED_PRECONDITION,
      `Chunk schema '${schema.name}' must not enable per-chunk authorization`,
    );
  }
  assertNoPersistedTextFields(schema.fields, `Chunk schema '${schema.name}'`);
  assertNoCredentialFields(schema.fields, `Chunk schema '${schema.name}'`);
}

export function buildChunkBackingSchema(
  profileInput: {
    provider?: string;
    modelName?: string;
    dimensions?: number;
    similarity?: string;
  },
  existingSchemaName?: string,
): ConduitSchema {
  const profile = assertVectorProfile(profileInput);
  const schema = new ConduitSchema(
    resolveChunkSchemaName(profile, existingSchemaName),
    chunkBackingFields(profile),
    hiddenChunkModelOptions(profile),
  );
  assertChunkSchemaContract(schema);
  return schema;
}

export function toPersistedChunk(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const persisted: Record<string, unknown> = {};
  for (const field of PERSISTED_CHUNK_FIELDS) {
    if (input[field] !== undefined) {
      persisted[field] = input[field];
    }
  }
  return persisted;
}

export async function ensureProfileChunkSchema(
  store: ChunkSchemaStore,
  profileInput: {
    provider?: string;
    modelName?: string;
    dimensions?: number;
    similarity?: string;
    chunkSchemaName?: string;
  },
  existingSchemaName?: string,
): Promise<BackingIndexState> {
  const profile = assertVectorProfile(profileInput);
  const schema = buildChunkBackingSchema(
    profile,
    existingSchemaName ?? profileInput.chunkSchemaName,
  );
  await store.createSchemaFromAdapter(schema);
  await store.migrate?.(schema.name);
  const indexes = await store.getVectorIndexes(schema.name);
  const contract = chunkVectorIndexDefinition(profile);
  const existing = selectEmbeddingVectorIndex(indexes, CHUNK_VECTOR_FIELD, {
    dimensions: profile.dimensions,
    similarity: profile.similarity,
    method: VectorIndexMethod.HNSW,
    filterFields: contract.filterFields,
  });
  if (!existing) {
    const replacement = {
      ...contract,
      name: indexes.some(index => index.field === CHUNK_VECTOR_FIELD)
        ? nextEmbeddingVectorIndexName(CHUNK_VECTOR_FIELD, indexes)
        : (contract.name ?? defaultEmbeddingVectorIndexName(CHUNK_VECTOR_FIELD)),
    };
    await store.createVectorIndex(schema.name, replacement);
    return {
      schemaName: schema.name,
      indexName: replacement.name,
      created: true,
    };
  }
  return {
    schemaName: schema.name,
    indexName: existing.name ?? defaultEmbeddingVectorIndexName(CHUNK_VECTOR_FIELD),
    created: false,
  };
}

export async function reconcileSourceChunkSchemas(
  sources: GenericSourceProfile[],
  store: ChunkSchemaStore,
  persistBackingIndex?: (id: string, state: BackingIndexState) => Promise<unknown>,
): Promise<BackingIndexState[]> {
  const states: BackingIndexState[] = [];
  for (const source of sources) {
    const state = await ensureProfileChunkSchema(store, source, source.chunkSchemaName);
    states.push(state);
    if (
      persistBackingIndex &&
      (source.chunkSchemaName !== state.schemaName ||
        source.chunkIndexName !== state.indexName)
    ) {
      await persistBackingIndex(source._id, state);
    }
  }
  return states;
}
