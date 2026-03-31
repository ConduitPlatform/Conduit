import assert from 'node:assert/strict';
import test from 'node:test';
import type { Model } from 'mongoose';
import { AuthzBulkMaxTotalIdsError } from './authorizedBulkConfig.js';
import {
  buildMongoKeysetFilter,
  mergeMongoBulkFilterWithIdIn,
  iterateAuthorizedMongoIdBatches,
} from './authorizedBulkMongo.js';

test('buildMongoKeysetFilter with no cursor', () => {
  assert.deepEqual(buildMongoKeysetFilter({ a: 1 }, null), { a: 1 });
});

test('buildMongoKeysetFilter with cursor', () => {
  assert.deepEqual(buildMongoKeysetFilter({ a: 1 }, 'last'), {
    $and: [{ a: 1 }, { _id: { $gt: 'last' } }],
  });
});

test('mergeMongoBulkFilterWithIdIn', () => {
  assert.deepEqual(mergeMongoBulkFilterWithIdIn({}, ['x']), { _id: { $in: ['x'] } });
  assert.deepEqual(mergeMongoBulkFilterWithIdIn({ f: 1 }, ['a', 'b']), {
    $and: [{ f: 1 }, { _id: { $in: ['a', 'b'] } }],
  });
});

test('iterateAuthorizedMongoIdBatches yields batches from mock model', async () => {
  let call = 0;
  const mockModel = {
    find() {
      return {
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: () => ({
                exec: async () => {
                  call++;
                  if (call === 1) return [{ _id: 10 }, { _id: 20 }];
                  return [];
                },
              }),
            }),
          }),
        }),
      };
    },
  } as unknown as Model<any>;

  const batches: unknown[][] = [];
  for await (const b of iterateAuthorizedMongoIdBatches(
    mockModel,
    {},
    { chunkSize: 10 },
  )) {
    batches.push(b);
  }
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], [10, 20]);
});

test('iterateAuthorizedMongoIdBatch respects CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS', async () => {
  const prev = process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS;
  process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS = '2';
  try {
    let call = 0;
    const mockModel = {
      find() {
        return {
          select: () => ({
            sort: () => ({
              limit: () => ({
                lean: () => ({
                  exec: async () => {
                    call++;
                    if (call === 1) return [{ _id: 1 }, { _id: 2 }, { _id: 3 }];
                    return [];
                  },
                }),
              }),
            }),
          }),
        };
      },
    } as unknown as Model<any>;

    await assert.rejects(
      async () => {
        for await (const _ of iterateAuthorizedMongoIdBatches(
          mockModel,
          {},
          { chunkSize: 10 },
        )) {
          // first batch 3 ids > max 2
        }
      },
      (e: unknown) => e instanceof AuthzBulkMaxTotalIdsError,
    );
  } finally {
    if (prev === undefined) delete process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS;
    else process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS = prev;
  }
});
