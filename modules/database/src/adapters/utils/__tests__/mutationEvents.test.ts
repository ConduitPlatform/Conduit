import { describe, expect, it } from '@jest/globals';
import {
  buildMutationEventChunks,
  collectDocumentIds,
  mutationEventChannel,
  shouldPublishMutationEvent,
} from '../mutationEvents.js';

describe('mutation event helpers', () => {
  it('publishes events unless suppressEvent is explicitly true', () => {
    expect(shouldPublishMutationEvent()).toBe(true);
    expect(shouldPublishMutationEvent(false)).toBe(true);
    expect(shouldPublishMutationEvent(true)).toBe(false);
  });

  it('maps updateOne onto the update channel instead of updateMany', () => {
    expect(mutationEventChannel('database', 'update', 'Article')).toBe(
      'database:update:Article',
    );
    expect(mutationEventChannel('database', 'updateMany', 'Article')).toBe(
      'database:updateMany:Article',
    );
  });

  it('collects document ids from create and bulk payloads', () => {
    expect(collectDocumentIds({ _id: 'a' })).toEqual(['a']);
    expect(collectDocumentIds([{ _id: 'a' }, { _id: 'b' }, { _id: 'a' }])).toEqual([
      'a',
      'b',
    ]);
  });

  it('does not treat a Mongo updateMany result as document ids', () => {
    expect(
      collectDocumentIds({
        acknowledged: true,
        matchedCount: 3,
        modifiedCount: 3,
        upsertedCount: 0,
        upsertedId: null,
      }),
    ).toEqual([]);
  });

  it('publishes affected ids in bounded chunks without altering caller-supplied ids', () => {
    const ids = ['1', '2', '3', '4', '5'];
    const chunks = buildMutationEventChunks(ids, 2);
    expect(chunks).toEqual([
      JSON.stringify([{ _id: '1' }, { _id: '2' }]),
      JSON.stringify([{ _id: '3' }, { _id: '4' }]),
      JSON.stringify([{ _id: '5' }]),
    ]);
    expect(ids).toEqual(['1', '2', '3', '4', '5']);
  });
});
