import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError, VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertClientSourceSearchRequest,
  assertFiniteVector,
  assertTrustedIngest,
  assertXorTextOrVector,
  hashChunkContent,
  HIDDEN_CHUNK_RESULT_FIELDS,
  ingestErrorMessage,
  ingestLimits,
  parseBoundedObject,
  sanitizeSourceSearchDocument,
  sourceSearchFilter,
  createOrResolveDuplicate,
  isDuplicateKeyError,
  upsertUniqueRecord,
} from './genericIngest.js';
import { toPersistedChunk } from './genericSource.js';

const profile = {
  provider: 'openai-compatible',
  modelName: 'text-embedding-3-small',
  dimensions: 3,
  similarity: VectorSimilarity.Cosine,
};

describe('generic ingest validation', () => {
  it('requires XOR bounded text or a finite exact-dimension vector', () => {
    assert.deepEqual(assertXorTextOrVector({ text: 'hello' }), { text: 'hello' });
    assert.deepEqual(assertXorTextOrVector({ vector: [1, 2, 3] }), {
      vector: [1, 2, 3],
    });
    assert.throws(
      () => assertXorTextOrVector({ text: 'hello', vector: [1, 2, 3] }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => assertXorTextOrVector({}),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => assertFiniteVector([1, Number.NaN, 3], 3),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => assertFiniteVector([1, 2], 3),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
  });

  it('drops text from persisted chunks and hashes discarded content', () => {
    const persisted = toPersistedChunk({
      documentId: 'doc1',
      sourceId: 'src1',
      chunkKey: 'c1',
      ordinal: 0,
      embedding: [0.1, 0.2, 0.3],
      contentHash: hashChunkContent(profile, 'hello'),
      text: 'hello',
      content: 'hello',
      metadata: { title: 'Note' },
      partitionSubject: 'Team:org',
      modelFingerprint: 'fp',
      status: 'indexed',
    });
    assert.equal('text' in persisted, false);
    assert.equal('content' in persisted, false);
    assert.deepEqual(persisted.embedding, [0.1, 0.2, 0.3]);
    assert.equal(typeof persisted.contentHash, 'string');
  });

  it('rejects credential metadata and honors ingest limits', () => {
    assert.throws(
      () => parseBoundedObject({ apiKey: 'secret' }, 'metadata', 4096),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    const limits = ingestLimits({
      security: { maxIngestBatchSize: 2, maxChunksPerDocument: 2 },
    } as never);
    assert.equal(limits.maxIngestBatchSize, 2);
    assert.deepEqual(limits.trustedIngestModules, [
      'database',
      'core',
      'storage',
      'embeddings',
    ]);
  });

  it('injects the same Mongo/Postgres source search prefilter', () => {
    const filter = sourceSearchFilter({
      sourceId: 'src1',
      partitionSubject: 'Team:org',
      extra: { mimeType: 'text/plain' },
    });
    assert.deepEqual(filter, {
      sourceId: 'src1',
      partitionSubject: 'Team:org',
      status: 'indexed',
      mimeType: 'text/plain',
    });
    assert.throws(
      () =>
        sourceSearchFilter({
          sourceId: 'src1',
          partitionSubject: 'Team:org',
          extra: { status: 'failed' },
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        sourceSearchFilter({
          sourceId: 'src1',
          partitionSubject: 'Team:org',
          extra: { partitionSubject: 'Team:other' },
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        sourceSearchFilter({
          sourceId: 'src1',
          partitionSubject: 'Team:org',
          extra: { embedding: [1, 2, 3] },
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
  });

  it('hides vector, hash, and text fields from search hits', () => {
    const safe = sanitizeSourceSearchDocument({
      hit: {
        sourceId: 'src1',
        documentId: 'doc1',
        chunkKey: 'c1',
        ordinal: 0,
        embedding: [1, 2, 3],
        contentHash: 'abc',
        modelFingerprint: 'fp',
        sourceLocator: 'file-1',
        partitionSubject: 'Team:org',
        mimeType: 'text/plain',
      },
      document: {
        externalDocumentId: 'ext-1',
        storageFileId: 'file-1',
        metadata: { title: 'Note', secret: 'nope' },
      },
      metadataAllowlist: ['title'],
    });
    assert.deepEqual(safe, {
      sourceId: 'src1',
      documentId: 'doc1',
      chunkKey: 'c1',
      ordinal: 0,
      mimeType: 'text/plain',
      externalDocumentId: 'ext-1',
      storageFileId: 'file-1',
      metadata: { title: 'Note' },
    });
    for (const field of HIDDEN_CHUNK_RESULT_FIELDS) {
      assert.equal(field in safe, false);
    }
  });

  it('enforces trusted ingest callers and client query-text-only search', () => {
    assert.doesNotThrow(() => assertTrustedIngest({ callerModule: 'storage' }));
    assert.throws(
      () => assertTrustedIngest({ callerModule: 'chat' }),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    assert.throws(
      () =>
        assertClientSourceSearchRequest({
          callerModule: 'router',
          queryVector: [1, 2, 3],
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        assertClientSourceSearchRequest({
          callerModule: 'router',
          adminOperator: true,
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });

  it('redacts secrets and references from ingest error text', () => {
    assert.doesNotMatch(
      ingestErrorMessage(
        new Error('provider timeout apiKey=sk-secret storageFileId=file-1'),
      ),
      /sk-secret|file-1/,
    );
  });

  it('treats duplicate-key races as idempotent creates', async () => {
    const duplicate = Object.assign(new Error('E11000 duplicate key error'), {
      code: 11000,
    });
    assert.equal(isDuplicateKeyError(duplicate), true);
    assert.equal(isDuplicateKeyError(new Error('timeout')), false);
    const created = await createOrResolveDuplicate({
      create: async () => {
        throw duplicate;
      },
      findExisting: async () => ({ _id: 'existing' }),
    });
    assert.equal(created._id, 'existing');
    const updates: string[] = [];
    let attempts = 0;
    await upsertUniqueRecord({
      findExisting: async () => {
        attempts += 1;
        return attempts === 1 ? null : { _id: 'raced' };
      },
      create: async () => {
        throw duplicate;
      },
      update: async id => {
        updates.push(id);
      },
    });
    assert.deepEqual(updates, ['raced']);
  });
});
