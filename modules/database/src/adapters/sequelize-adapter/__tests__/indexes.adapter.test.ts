import { describe, expect, it, jest } from '@jest/globals';
import { CompatibleIndexType, PostgresIndexType } from '@conduitplatform/grpc-sdk';
import { SequelizeAdapter } from '../index.js';

class TestSequelizeAdapter extends SequelizeAdapter {
  protected async hasLegacyCollections(): Promise<boolean> {
    return false;
  }
}

function makeAdapter(dialect: string = 'postgres') {
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
  } as any;
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
  } as any;
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

describe('sequelize adapter indexes T24 T30–T33', () => {
  it('T24 getDatabaseType still returns PostgreSQL, not postgres', () => {
    const { adapter } = makeAdapter('postgres');
    expect(adapter.getDatabaseType()).toBe('PostgreSQL');
  });

  it('T30 create/get/delete use originalSchema.collectionName, not a hardcoded cnd_ prefix', async () => {
    const { adapter, addIndex, removeIndex, showIndex } = makeAdapter();
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

  it('T31 create does not rebuild/sync the schema', async () => {
    const { adapter, sync } = makeAdapter();
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'database',
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it('T32 getIndexes reads the live engine and overlays declared Compatible types', async () => {
    const { adapter, showIndex, originalSchema } = makeAdapter();
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

  it('T33 delete awaits removeIndex and persists', async () => {
    const { adapter, removeIndex, findByIdAndUpdate } = makeAdapter();
    await adapter.deleteIndexes('User', ['cnd_idx_email_asc']);
    expect(removeIndex).toHaveBeenCalledTimes(1);
    expect(findByIdAndUpdate).toHaveBeenCalled();
  });

  it('mysql HASH is allowed; sqlite HASH throws on Admin create', async () => {
    const mysql = makeAdapter('mysql');
    await expect(
      mysql.adapter.createIndexes(
        'User',
        [{ fields: ['email'], types: PostgresIndexType.HASH }],
        'database',
        { privileged: true },
      ),
    ).resolves.toBe('Indexes created!');

    const sqlite = makeAdapter('sqlite');
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
