import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  buildMutationEventChunks,
  collectBoundedMutationIds,
  collectDocumentIds,
  MAX_MUTATION_EVENT_COLLECT_IDS,
  mutationEventChannel,
  mutationIdCollectionExhaustedError,
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

  it('pages and caps updateMany mutation id collection instead of materializing unlimited ids', async () => {
    const docs = Array.from({ length: 7 }, (_, index) => ({ _id: String(index) }));
    const seen: Array<{ skip: number; limit: number }> = [];
    const ids = await collectBoundedMutationIds({
      findPage: async (skip, limit) => {
        seen.push({ skip, limit });
        return docs.slice(skip, skip + limit);
      },
      cap: 10,
      pageSize: 3,
    });
    expect(ids).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    expect(seen).toEqual([
      { skip: 0, limit: 3 },
      { skip: 3, limit: 3 },
      { skip: 6, limit: 3 },
    ]);

    await expect(
      collectBoundedMutationIds({
        findPage: async (skip, limit) =>
          Array.from({ length: limit }, (_, index) => ({
            _id: String(skip + index),
          })),
        cap: 4,
        pageSize: 3,
      }),
    ).rejects.toMatchObject({
      code: status.RESOURCE_EXHAUSTED,
      message: mutationIdCollectionExhaustedError(4).message,
    });
    expect(mutationIdCollectionExhaustedError().code).toBe(status.RESOURCE_EXHAUSTED);
    expect(MAX_MUTATION_EVENT_COLLECT_IDS).toBe(10_000);
  });
});
