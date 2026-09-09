import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError, VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { validateEmbeddingConfigInput } from './validateEmbeddingConfig.js';

describe('validateEmbeddingConfigInput', () => {
  const defaults = {
    provider: 'openai-compatible',
    providers: {
      'openai-compatible': {
        models: [
          { name: 'text-embedding-3-small', dimensions: 1536 },
          { name: 'text-embedding-3-large', dimensions: 3072 },
        ],
        defaultModel: 'text-embedding-3-small',
      },
    },
  };
  const valid = {
    schemaName: 'Article',
    sourceFields: ['title', 'body'],
    targetField: 'embedding',
    dimensions: 1536,
  };

  it('accepts object-form config with a supported similarity enum', () => {
    const result = validateEmbeddingConfigInput(
      {
        ...valid,
        similarity: VectorSimilarity.DotProduct,
        model: 'text-embedding-3-small',
      },
      defaults,
    );
    assert.equal(result.similarity, VectorSimilarity.DotProduct);
    assert.equal(result.provider, 'openai-compatible');
    assert.equal(result.modelName, 'text-embedding-3-small');
    assert.equal(result.dimensions, 1536);
    assert.deepEqual(result.sourceFieldAllowlist, []);
  });

  it('defaults omitted similarity to cosine and omitted model to the catalogue default', () => {
    const result = validateEmbeddingConfigInput(
      { schemaName: 'Article', sourceFields: ['title'], targetField: 'embedding' },
      defaults,
    );
    assert.equal(result.similarity, VectorSimilarity.Cosine);
    assert.equal(result.modelName, 'text-embedding-3-small');
    assert.equal(result.dimensions, 1536);
  });

  it('rejects missing identity fields', () => {
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, sourceFields: [] }, defaults),
      /required/,
    );
  });

  it('rejects unknown providers and models', () => {
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, provider: 'missing' }, defaults),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /not a configured provider/.test(err.message),
    );
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, model: 'missing' }, defaults),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /not in the catalogue/.test(err.message),
    );
  });

  it('rejects explicit dimension mismatches and ignores omitted proto dimensions', () => {
    assert.throws(
      () =>
        validateEmbeddingConfigInput(
          { ...valid, model: 'text-embedding-3-small', dimensions: 768 },
          defaults,
        ),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /do not match catalogue dimensions/.test(err.message),
    );
    const omitted = validateEmbeddingConfigInput(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        model: 'text-embedding-3-large',
        dimensions: 0,
      },
      defaults,
    );
    assert.equal(omitted.dimensions, 3072);
    assert.equal(omitted.modelName, 'text-embedding-3-large');
  });

  it('rejects unsupported similarity values', () => {
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, similarity: 'manhattan' }, defaults),
      /Unsupported similarity/,
    );
  });

  it('validates source fields against the schema when provided', () => {
    assert.throws(
      () =>
        validateEmbeddingConfigInput(valid, defaults, {
          title: { type: 'String' },
          password: { type: 'String' },
        }),
      /does not exist/,
    );
    const result = validateEmbeddingConfigInput(valid, defaults, {
      title: { type: 'String' },
      body: { type: 'String' },
    });
    assert.deepEqual(result.sourceFields, ['title', 'body']);
  });
});
