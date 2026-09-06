import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  embeddingOwnedFields,
  extractDocumentIds,
  isEmbeddingOwnedMutation,
  parseMutationEvent,
} from './mutationEvents.js';

describe('embedding mutation event parsing', () => {
  it('normalizes create, update, and bulk payloads to unique ids', () => {
    assert.deepEqual(parseMutationEvent(JSON.stringify({ _id: 'a', title: 'x' })), {
      payload: { _id: 'a', title: 'x' },
      ids: ['a'],
    });
    assert.deepEqual(extractDocumentIds([{ _id: 'a' }, { _id: 'b' }, { _id: 'a' }]), [
      'a',
      'b',
    ]);
    assert.deepEqual(extractDocumentIds({ ids: ['a', 'b', 'a'] }), ['a', 'b']);
  });

  it('ignores Mongo updateMany result objects that have no document ids', () => {
    assert.deepEqual(
      extractDocumentIds({
        acknowledged: true,
        matchedCount: 4,
        modifiedCount: 4,
      }),
      [],
    );
    assert.equal(
      parseMutationEvent(
        JSON.stringify({ acknowledged: true, matchedCount: 2, modifiedCount: 2 }),
      )?.ids.length,
      0,
    );
  });

  it('parses bounded bulk id chunks', () => {
    assert.deepEqual(extractDocumentIds([{ _id: '1' }, { _id: '2' }]), ['1', '2']);
  });

  it('treats embedding-owned write-backs as skippable and keeps source updates', () => {
    const owned = embeddingOwnedFields([{ targetField: 'embedding' }]);
    assert.equal(
      isEmbeddingOwnedMutation(
        {
          _id: 'a',
          embedding: [0.1, 0.2],
          embeddingSourceHash: 'abc',
          updatedAt: 'now',
        },
        owned,
      ),
      true,
    );
    assert.equal(
      isEmbeddingOwnedMutation({ _id: 'a', title: 'changed', embedding: [0.1] }, owned),
      false,
    );
    assert.equal(isEmbeddingOwnedMutation({ _id: 'a' }, owned), false);
  });

  it('returns null for malformed payloads', () => {
    assert.equal(parseMutationEvent('{not json'), null);
  });
});
