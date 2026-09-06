import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { validateEmbeddingConfigInput } from './validateEmbeddingConfig.js';

describe('validateEmbeddingConfigInput', () => {
  const defaults = { provider: 'openai-compatible' };
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
    assert.equal(result.dimensions, 1536);
    assert.deepEqual(result.sourceFieldAllowlist, []);
  });

  it('defaults omitted similarity to cosine', () => {
    const result = validateEmbeddingConfigInput(valid, defaults);
    assert.equal(result.similarity, VectorSimilarity.Cosine);
  });

  it('rejects missing identity fields', () => {
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, sourceFields: [] }, defaults),
      /required/,
    );
  });

  it('rejects non-positive and non-integer dimensions', () => {
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, dimensions: 0 }, defaults),
      /positive integer/,
    );
    assert.throws(
      () => validateEmbeddingConfigInput({ ...valid, dimensions: 12.3 }, defaults),
      /positive integer/,
    );
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
