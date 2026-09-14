import { describe, expect, it, jest } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import {
  CompatibleIndexType,
  MongoIndexType,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import { MongooseAdapter } from '../../adapters/mongoose-adapter/index.js';
import { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';

function makeMongooseAdapter(overrides: Record<string, unknown> = {}) {
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
  } as MongooseAdapter['mongoose'];
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
  } as MongooseAdapter['models'];
  return { adapter, createIndex, dropIndex, indexes, findByIdAndUpdate, originalSchema };
}

class TestSequelizeAdapter extends SequelizeAdapter {
  protected async hasLegacyCollections(): Promise<boolean> {
    return false;
  }
}

function makeSequelizeAdapter(dialect = 'postgres') {
  const addIndex = jest.fn().mockResolvedValue(undefined);
  const removeIndex = jest.fn().mockResolvedValue(undefined);
  const showIndex = jest.fn().mockResolvedValue([
    {
      name: 'cnd_idx_email_asc',
      unique: false,
      fields: [{ attribute: 'email', order: 'ASC' }],
      definition: 'CREATE INDEX cnd_idx_email_asc ON cnd_User USING btree (email)',
    },
  ]);
  const findOne = jest.fn().mockResolvedValue({ _id: 'declared-1' });
  const findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const sync = jest.fn().mockResolvedValue(undefined);
  const adapter = Object.create(TestSequelizeAdapter.prototype) as SequelizeAdapter;
  adapter.sequelize = {
    getDialect: () => dialect,
    getQueryInterface: () => ({ addIndex, removeIndex, showIndex }),
  } as SequelizeAdapter['sequelize'];
  const originalSchema = {
    name: 'User',
    ownerModule: 'database',
    collectionName: 'custom_users',
    fields: { email: { type: 'String' } },
    compiledFields: { email: { type: 'String' } },
    modelOptions: { indexes: [] as unknown[] },
  };
  adapter.models = {
    User: { originalSchema, sync },
    _DeclaredSchema: { findOne, findByIdAndUpdate },
  } as SequelizeAdapter['models'];
  return {
    adapter,
    addIndex,
    removeIndex,
    showIndex,
    sync,
    findByIdAndUpdate,
    originalSchema,
  };
}

describe('mongoose adapter indexes', () => {
  it('creates a single key spec object, not an array of objects', async () => {
    const { adapter, createIndex } = makeMongooseAdapter();
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'chat',
    );
    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(createIndex.mock.calls[0][0]).toEqual({ email: MongoIndexType.Ascending });
    expect(Array.isArray(createIndex.mock.calls[0][0])).toBe(false);
  });

  it('persists created and deleted indexes on _DeclaredSchema', async () => {
    const created = makeMongooseAdapter();
    await created.adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'chat',
    );
    expect(created.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const update = created.findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes[0].name).toMatch(/email/);

    const deleted = makeMongooseAdapter({
      originalSchema: {
        modelOptions: { indexes: [{ fields: ['email'], name: 'cnd_idx_email_asc' }] },
      },
    });
    await deleted.adapter.deleteIndexes('User', ['cnd_idx_email_asc']);
    expect(deleted.originalSchema.modelOptions.indexes).toEqual([]);
    expect(deleted.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('awaits dropIndex', async () => {
    const { adapter, dropIndex } = makeMongooseAdapter();
    let resolveDrop: () => void = () => undefined;
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

  it('reads live engine indexes', async () => {
    const { adapter, indexes } = makeMongooseAdapter();
    const result = await adapter.getIndexes('User');
    expect(indexes).toHaveBeenCalled();
    expect(result.map(index => index.name)).toEqual(['_id_', 'cnd_idx_email_asc']);
    expect(result[1].fields).toEqual(['email']);
  });

  it('throws on Admin-bound invalid types and allows privileged unique', async () => {
    const { adapter } = makeMongooseAdapter();
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], types: [PostgresIndexType.GIST] }],
        'database',
        { privileged: true },
      ),
    ).rejects.toMatchObject({ code: status.INVALID_ARGUMENT });
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

describe('sequelize adapter indexes', () => {
  it('keeps getDatabaseType as PostgreSQL', () => {
    const { adapter } = makeSequelizeAdapter('postgres');
    expect(adapter.getDatabaseType()).toBe('PostgreSQL');
  });

  it('uses originalSchema.collectionName instead of a hardcoded cnd_ prefix', async () => {
    const { adapter, addIndex, removeIndex, showIndex } = makeSequelizeAdapter();
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'database',
      { privileged: true },
    );
    expect(addIndex.mock.calls[0][0]).toBe('custom_users');
    expect(addIndex.mock.calls[0][0]).not.toBe('cnd_User');
    await adapter.getIndexes('User');
    expect(showIndex).toHaveBeenCalledWith('custom_users');
    await adapter.deleteIndexes('User', ['cnd_idx_email_asc']);
    expect(removeIndex).toHaveBeenCalledWith('custom_users', 'cnd_idx_email_asc');
  });

  it('does not rebuild or sync the schema when creating indexes', async () => {
    const { adapter, sync } = makeSequelizeAdapter();
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'database',
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it('reads the live engine and overlays declared Compatible types', async () => {
    const { adapter, showIndex, originalSchema } = makeSequelizeAdapter();
    originalSchema.modelOptions.indexes = [
      {
        fields: ['email'],
        name: 'cnd_idx_email_asc',
        types: [CompatibleIndexType.Ascending],
      },
    ];
    const result = await adapter.getIndexes('User');
    expect(showIndex).toHaveBeenCalledWith('custom_users');
    expect(result[0].types).toEqual([CompatibleIndexType.Ascending]);
    expect(result[0].fields).toEqual(['email']);
  });

  it('awaits removeIndex and persists the deletion', async () => {
    const { adapter, removeIndex, findByIdAndUpdate } = makeSequelizeAdapter();
    await adapter.deleteIndexes('User', ['cnd_idx_email_asc']);
    expect(removeIndex).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdate).toHaveBeenCalled();
  });

  it('allows HASH on mysql and rejects it on sqlite', async () => {
    const mysql = makeSequelizeAdapter('mysql');
    await expect(
      mysql.adapter.createIndexes(
        'User',
        [{ fields: ['email'], types: PostgresIndexType.HASH }],
        'database',
        { privileged: true },
      ),
    ).resolves.toBe('Indexes created!');

    const sqlite = makeSequelizeAdapter('sqlite');
    await expect(
      sqlite.adapter.createIndexes(
        'User',
        [{ fields: ['email'], types: PostgresIndexType.HASH }],
        'database',
        { privileged: true },
      ),
    ).rejects.toMatchObject({ message: expect.stringMatching(/sqlite/i) });
  });
});
