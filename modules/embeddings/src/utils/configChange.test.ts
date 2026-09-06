import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffMaterialEmbeddingConfig,
  embeddingConfigFingerprint,
  hashFieldsToInvalidate,
  hashedEmbeddingSource,
  isInPlaceDimensionChange,
  materialChangeWarnings,
  requiresIndexRecreation,
} from './configChange.js';

const base = {
  provider: 'openai-compatible',
  modelName: 'text-embedding-3-small',
  dimensions: 1536,
  sourceFields: ['title', 'body'],
  targetField: 'embedding',
  similarity: 'cosine',
};

describe('material embedding config changes', () => {
  it('detects provider, model, dimensions, source fields, target, and similarity changes', () => {
    assert.deepEqual(diffMaterialEmbeddingConfig(base, base), []);
    assert.deepEqual(
      diffMaterialEmbeddingConfig(base, { ...base, sourceFields: ['body', 'title'] }),
      [],
    );
    assert.deepEqual(diffMaterialEmbeddingConfig(base, { ...base, modelName: 'large' }), [
      'modelName',
    ]);
    assert.deepEqual(
      diffMaterialEmbeddingConfig(base, {
        ...base,
        provider: 'other',
        dimensions: 768,
        sourceFields: ['title'],
        targetField: 'vector',
        similarity: 'euclidean',
      }),
      ['provider', 'dimensions', 'sourceFields', 'targetField', 'similarity'],
    );
  });

  it('requires index recreation for dimensions, target field, and similarity', () => {
    assert.equal(requiresIndexRecreation(['modelName', 'provider']), false);
    assert.equal(requiresIndexRecreation(['sourceFields']), false);
    assert.equal(requiresIndexRecreation(['similarity']), true);
    assert.equal(requiresIndexRecreation(['dimensions']), true);
    assert.equal(requiresIndexRecreation(['targetField']), true);
    assert.equal(isInPlaceDimensionChange(base, { ...base, dimensions: 768 }), true);
    assert.equal(
      isInPlaceDimensionChange(base, {
        ...base,
        targetField: 'other',
        dimensions: 768,
      }),
      false,
    );
  });

  it('invalidates old hashes via fingerprint and names hash fields to clear', () => {
    const hash = (input: string) => input;
    const original = hashedEmbeddingSource(hash, 'Hello', base);
    const changedModel = hashedEmbeddingSource(hash, 'Hello', {
      ...base,
      modelName: 'large',
    });
    assert.notEqual(original, changedModel);
    assert.equal(
      embeddingConfigFingerprint(base).includes('text-embedding-3-small'),
      true,
    );
    assert.deepEqual(hashFieldsToInvalidate(base, { ...base, targetField: 'other' }), [
      'embeddingSourceHash',
      'otherSourceHash',
    ]);
  });

  it('warns that stale vectors require an explicit backfill', () => {
    const warnings = materialChangeWarnings(['modelName'], false);
    assert.equal(
      warnings.some(warning => /invalidated stored source hashes/.test(warning)),
      true,
    );
    assert.equal(
      warnings.some(warning => /explicit backfill/.test(warning)),
      true,
    );
    assert.equal(
      materialChangeWarnings(['similarity'], true).some(warning =>
        /index recreation is required/i.test(warning),
      ),
      true,
    );
  });
});
