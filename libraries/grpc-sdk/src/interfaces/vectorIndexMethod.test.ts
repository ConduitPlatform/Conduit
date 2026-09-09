import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultVectorIndexMethod,
  VectorIndexMethod,
  vectorIndexMethodsEquivalent,
} from '../../dist/index.esm.js';

describe('vector index method defaults', () => {
  it('treats empty proto method and missing method as hnsw', () => {
    assert.equal(defaultVectorIndexMethod(), VectorIndexMethod.HNSW);
    assert.equal(defaultVectorIndexMethod(undefined), VectorIndexMethod.HNSW);
    assert.equal(defaultVectorIndexMethod(null), VectorIndexMethod.HNSW);
    assert.equal(defaultVectorIndexMethod(''), VectorIndexMethod.HNSW);
    assert.equal(defaultVectorIndexMethod('hnsw'), VectorIndexMethod.HNSW);
    assert.equal(defaultVectorIndexMethod('ivfflat'), VectorIndexMethod.IVFFlat);
    assert.equal(defaultVectorIndexMethod('flat'), VectorIndexMethod.Flat);
    assert.equal(vectorIndexMethodsEquivalent('', undefined), true);
    assert.equal(vectorIndexMethodsEquivalent('hnsw', ''), true);
    assert.equal(vectorIndexMethodsEquivalent('flat', ''), false);
  });
});
