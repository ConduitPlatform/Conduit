import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffMaterialEmbeddingConfig,
  embeddingConfigFingerprint,
  hashFieldsToInvalidate,
  hashedEmbeddingSource,
  isInPlaceDimensionChange,
  materialChangeWarnings,
  nextEmbeddingVectorIndexName,
  requiresIndexRecreation,
  selectEmbeddingVectorIndex,
  sameEmbeddingVectorIndexFamily,
  embeddingVectorIndexMatchesContract,
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

  it('versions replacement names from live provider-specific indexes', () => {
    assert.equal(nextEmbeddingVectorIndexName('embedding', []), 'embedding_vector');
    assert.equal(
      nextEmbeddingVectorIndexName('embedding', [
        { field: 'embedding', name: 'embedding_vector' },
      ]),
      'embedding_vector_v2',
    );
    assert.equal(
      nextEmbeddingVectorIndexName('embedding', [
        { field: 'embedding', name: 'cnd_Article_embedding_vector' },
        { field: 'embedding', name: 'cnd_Article_embedding_vector_v2' },
      ]),
      'cnd_Article_embedding_vector_v3',
    );
    assert.equal(
      sameEmbeddingVectorIndexFamily('embedding_vector', 'embedding_vector_v2'),
      true,
    );
    assert.equal(
      selectEmbeddingVectorIndex(
        [
          { field: 'embedding', name: 'embedding_vector' },
          { field: 'embedding', name: 'embedding_vector_v2' },
          { field: 'title', name: 'title_vector_v9' },
        ],
        'embedding',
      )?.name,
      'embedding_vector_v2',
    );
  });

  it('matches live indexes only when field, dimensions, similarity, and method agree', () => {
    const cosine = {
      field: 'embedding',
      name: 'embedding_vector',
      dimensions: 3,
      similarity: 'cosine',
      method: 'hnsw',
    };
    const euclidean = {
      ...cosine,
      name: 'embedding_vector_v2',
      similarity: 'euclidean',
    };
    const ivf = { ...cosine, method: 'ivfflat' };
    assert.equal(
      embeddingVectorIndexMatchesContract(cosine, {
        field: 'embedding',
        dimensions: 3,
        similarity: 'cosine',
      }),
      true,
    );
    assert.equal(
      embeddingVectorIndexMatchesContract(cosine, {
        field: 'embedding',
        dimensions: 3,
        similarity: 'euclidean',
      }),
      false,
    );
    assert.equal(
      embeddingVectorIndexMatchesContract(cosine, {
        field: 'embedding',
        dimensions: 8,
        similarity: 'cosine',
      }),
      false,
    );
    assert.equal(
      embeddingVectorIndexMatchesContract(ivf, {
        field: 'embedding',
        dimensions: 3,
        similarity: 'cosine',
      }),
      false,
    );
    assert.equal(
      selectEmbeddingVectorIndex([cosine, euclidean], 'embedding', {
        dimensions: 3,
        similarity: 'euclidean',
      })?.name,
      'embedding_vector_v2',
    );
    assert.equal(
      selectEmbeddingVectorIndex([cosine], 'embedding', {
        dimensions: 3,
        similarity: 'euclidean',
      }),
      undefined,
    );
  });

  it('treats empty and missing index methods as default hnsw', () => {
    const missingMethod = {
      field: 'embedding',
      name: 'embedding_vector',
      dimensions: 3,
      similarity: 'cosine',
    };
    const emptyMethod = { ...missingMethod, method: '' };
    const hnsw = { ...missingMethod, method: 'hnsw' };
    const contract = {
      field: 'embedding',
      dimensions: 3,
      similarity: 'cosine',
    };
    assert.equal(embeddingVectorIndexMatchesContract(missingMethod, contract), true);
    assert.equal(embeddingVectorIndexMatchesContract(emptyMethod, contract), true);
    assert.equal(
      embeddingVectorIndexMatchesContract(hnsw, { ...contract, method: '' }),
      true,
    );
    assert.equal(
      selectEmbeddingVectorIndex([missingMethod], 'embedding', {
        dimensions: 3,
        similarity: 'cosine',
      })?.name,
      'embedding_vector',
    );
    assert.equal(
      nextEmbeddingVectorIndexName('embedding', [missingMethod]),
      'embedding_vector_v2',
    );
  });
});
