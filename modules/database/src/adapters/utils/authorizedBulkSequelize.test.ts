import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelStatic } from 'sequelize';
import { AuthzBulkMaxTotalIdsError } from './authorizedBulkConfig.js';
import { iterateAuthorizedSequelizeIdBatches } from './authorizedBulkSequelize.js';

test('iterateAuthorizedSequelizeIdBatches yields id batches', async () => {
  let offset = 0;
  const mockModel = {
    findAll: async (opts: { limit?: number; offset?: number }) => {
      const lim = opts.limit ?? 0;
      const off = opts.offset ?? 0;
      if (off === 0) {
        offset = lim;
        return [
          { get: (k: string) => (k === '_id' ? 'a' : null) },
          { get: (k: string) => (k === '_id' ? 'b' : null) },
        ];
      }
      return [];
    },
  } as unknown as ModelStatic<any>;

  const batches: unknown[][] = [];
  for await (const b of iterateAuthorizedSequelizeIdBatches(
    mockModel,
    { x: 1 },
    '_id',
    2,
    0,
  )) {
    batches.push(b);
  }
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], ['a', 'b']);
});

test('iterateAuthorizedSequelizeIdBatches throws when max total exceeded', async () => {
  const prev = process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS;
  process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS = '1';
  try {
    const mockModel = {
      findAll: async () => [
        { get: (k: string) => (k === '_id' ? 'x' : null) },
        { get: (k: string) => (k === '_id' ? 'y' : null) },
      ],
    } as unknown as ModelStatic<any>;

    await assert.rejects(
      async () => {
        for await (const _ of iterateAuthorizedSequelizeIdBatches(
          mockModel,
          {},
          '_id',
          10,
          1,
        )) {
          //
        }
      },
      (e: unknown) => e instanceof AuthzBulkMaxTotalIdsError,
    );
  } finally {
    if (prev === undefined) delete process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS;
    else process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS = prev;
  }
});
