import { describe, expect, it, jest } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { CompatibleIndexType, MongoIndexType } from '@conduitplatform/grpc-sdk';
import { MongooseAdapter } from '../index.js';

function makeAdapter(overrides: Record<string, unknown> = {}) {
  const createIndex = jest.fn().mockResolvedValue('email_1');
  const dropIndex = jest.fn().mockResolvedValue(undefined);
  const indexes = jest.fn().mockResolvedValue([
    { v: 2, key: { _id: 1 }, name: '_id_' },
    { v: 2, key: { email: 1 }, name: 'cnd_idx_email_asc', unique: false },
  ]);
  const findOne = jest.fn().mockResolvedValue({ _id: 'declared-1' });
  const findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
  adapter.mongoose = {
    model: () => ({ collection: { createIndex, dropIndex, indexes } }),
  } as any;
  const originalSchema = {
    name: 'User',
    ownerModule: 'chat',
    collectionName: 'cnd_User',
    fields: { email: { type: 'String' } },
    compiledFields: { email: { type: 'String' } },
    modelOptions: { indexes: [] as unknown[] },
    ...((overrides.originalSchema as object) ?? {}),
  };
  adapter.models = {
    User: { originalSchema },
    _DeclaredSchema: { findOne, findByIdAndUpdate },
  } as any;
  return { adapter, createIndex, dropIndex, indexes, findByIdAndUpdate, originalSchema };
}

describe('mongoose adapter indexes T26–T29 T34 T38', () => {
  it('T26 createIndex uses a single key spec object, not an array of objects', async () => {
    const { adapter, createIndex } = makeAdapter();
    await adapter.createIndexes(
      'User',
      [
        {
          fields: ['email'],
          types: [CompatibleIndexType.Ascending],
        },
      ],
      'chat',
    );
    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(createIndex.mock.calls[0][0]).toEqual({ email: MongoIndexType.Ascending });
    expect(Array.isArray(createIndex.mock.calls[0][0])).toBe(false);
  });

  it('T27 create persists metadata into _DeclaredSchema', async () => {
    const { adapter, findByIdAndUpdate } = makeAdapter();
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'chat',
    );
    expect(findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes[0].name).toMatch(/email/);
  });

  it('T28 delete awaits dropIndex', async () => {
    const { adapter, dropIndex } = makeAdapter();
    let resolveDrop: () => void = () => {};
    const dropped = new Promise<void>(resolve => {
      resolveDrop = resolve;
    });
    dropIndex.mockImplementation(async () => {
      resolveDrop();
    });
    await adapter.deleteIndexes('User', ['cnd_idx_email_asc']);
    await dropped;
    expect(dropIndex).toHaveBeenCalledWith('cnd_idx_email_asc');
  });

  it('T29 delete persists removal', async () => {
    const { adapter, findByIdAndUpdate, originalSchema } = makeAdapter({
      originalSchema: {
        modelOptions: { indexes: [{ fields: ['email'], name: 'cnd_idx_email_asc' }] },
      },
    });
    await adapter.deleteIndexes('User', ['cnd_idx_email_asc']);
    expect(originalSchema.modelOptions.indexes).toEqual([]);
    expect(findByIdAndUpdate).toHaveBeenCalled();
  });

  it('T34 getIndexes uses the live engine as source of truth', async () => {
    const { adapter, indexes } = makeAdapter();
    const result = await adapter.getIndexes('User');
    expect(indexes).toHaveBeenCalled();
    expect(result.map(i => i.name)).toEqual(['_id_', 'cnd_idx_email_asc']);
    expect(result[1].fields).toEqual(['email']);
  });

  it('T38 Admin-bound invalid types throw', async () => {
    const { adapter } = makeAdapter();
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], types: ['GIST'] as any }],
        'database',
        { privileged: true },
      ),
    ).rejects.toMatchObject({ code: status.INVALID_ARGUMENT });
  });

  it('T15 Admin privileged unique is allowed on a foreign-owned schema', async () => {
    const { adapter } = makeAdapter();
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], options: { unique: true } }],
        'database',
        { privileged: true },
      ),
    ).resolves.toBe('Indexes created!');
  });
});
