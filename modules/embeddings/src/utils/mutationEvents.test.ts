import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  embeddingOwnedFields,
  extractDocumentIds,
  isEmbeddingOwnedMutation,
  parseBoundedMutationEvent,
} from './mutationEvents.js';

describe('embedding mutation event parsing', () => {
  it('normalizes create, update, and bulk payloads to unique ids', () => {
    const parsed = parseBoundedMutationEvent(JSON.stringify({ _id: 'a', title: 'x' }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.event, {
        payload: { _id: 'a', title: 'x' },
        ids: ['a'],
      });
    }
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
    const parsed = parseBoundedMutationEvent(
      JSON.stringify({ acknowledged: true, matchedCount: 2, modifiedCount: 2 }),
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.event.ids.length, 0);
    }
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

  it('fails closed on oversized bus payloads instead of crashing', () => {
    assert.deepEqual(parseBoundedMutationEvent('{not json'), {
      ok: false,
      reason: 'malformed',
    });
    assert.deepEqual(parseBoundedMutationEvent('x'.repeat(300_000)), {
      ok: false,
      reason: 'capped',
    });
    assert.deepEqual(
      parseBoundedMutationEvent(JSON.stringify({ ids: ['a', 'b', 'c'] }), 2),
      { ok: false, reason: 'capped' },
    );
  });
});
