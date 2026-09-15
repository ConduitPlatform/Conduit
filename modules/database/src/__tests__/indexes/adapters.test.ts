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
  const indexes = jest.fn().mockResolvedValue([{ v: 2, key: { _id: 1 }, name: '_id_' }]);
  const findOne = jest
    .fn()
    .mockResolvedValue({ _id: 'declared-1', modelOptions: { indexes: [] } });
  const findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const publish = jest.fn();
  const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
  adapter.mongoose = {
    model: () => ({ collection: { createIndex, dropIndex, indexes } }),
  } as MongooseAdapter['mongoose'];
  (adapter as unknown as { grpcSdk: { bus: { publish: typeof publish } } }).grpcSdk = {
    bus: { publish },
  };
  const originalSchema = {
    name: 'User',
    ownerModule: 'chat',
    collectionName: 'cnd_User',
    fields: {
      email: { type: 'String' },
      room: { type: 'String' },
      createdAt: { type: 'Date' },
    },
    compiledFields: {
      email: { type: 'String' },
      room: { type: 'String' },
      createdAt: { type: 'Date' },
    },
    modelOptions: { indexes: [] as unknown[] },
    ...((overrides.originalSchema as object) ?? {}),
  };
  adapter.models = {
    User: { originalSchema },
    _DeclaredSchema: { findOne, findByIdAndUpdate },
  } as MongooseAdapter['models'];
  findOne.mockImplementation(async () => ({
    _id: 'declared-1',
    modelOptions: originalSchema.modelOptions,
  }));
  return {
    adapter,
    createIndex,
    dropIndex,
    indexes,
    findOne,
    findByIdAndUpdate,
    publish,
    originalSchema,
  };
}

class TestSequelizeAdapter extends SequelizeAdapter {
  protected async hasLegacyCollections(): Promise<boolean> {
    return false;
  }
}

function makeSequelizeAdapter(dialect = 'postgres') {
  const addIndex = jest.fn().mockResolvedValue(undefined);
  const removeIndex = jest.fn().mockResolvedValue(undefined);
  const showIndex = jest.fn().mockResolvedValue([]);
  const findOne = jest
    .fn()
    .mockResolvedValue({ _id: 'declared-1', modelOptions: { indexes: [] } });
  const findByIdAndUpdate = jest.fn().mockResolvedValue({});
  const publish = jest.fn();
  const sync = jest.fn().mockResolvedValue(undefined);
  const adapter = Object.create(TestSequelizeAdapter.prototype) as SequelizeAdapter;
  adapter.sequelize = {
    getDialect: () => dialect,
    getQueryInterface: () => ({ addIndex, removeIndex, showIndex }),
  } as SequelizeAdapter['sequelize'];
  (adapter as unknown as { grpcSdk: { bus: { publish: typeof publish } } }).grpcSdk = {
    bus: { publish },
  };
  const originalSchema = {
    name: 'User',
    ownerModule: 'database',
    collectionName: 'custom_users',
    fields: {
      email: { type: 'String' },
      room: { type: 'String' },
      createdAt: { type: 'Date' },
    },
    compiledFields: {
      email: { type: 'String' },
      room: { type: 'String' },
      createdAt: { type: 'Date' },
    },
    modelOptions: { indexes: [] as unknown[] },
  };
  adapter.models = {
    User: { originalSchema, sync },
    _DeclaredSchema: { findOne, findByIdAndUpdate },
  } as SequelizeAdapter['models'];
  findOne.mockImplementation(async () => ({
    _id: 'declared-1',
    modelOptions: originalSchema.modelOptions,
  }));
  return {
    adapter,
    addIndex,
    removeIndex,
    showIndex,
    sync,
    findOne,
    findByIdAndUpdate,
    publish,
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
    expect(created.findOne.mock.calls[0][1]).toEqual({ readPreference: 'primary' });
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
    indexes.mockResolvedValue([
      { v: 2, key: { _id: 1 }, name: '_id_' },
      { v: 2, key: { email: 1 }, name: 'cnd_idx_email_asc', unique: false },
    ]);
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

  it('adopts a live compound name and skips createIndex', async () => {
    const { adapter, createIndex, indexes, findByIdAndUpdate } = makeMongooseAdapter();
    indexes.mockResolvedValue([
      { v: 2, key: { _id: 1 }, name: '_id_' },
      { v: 2, key: { room: 1, createdAt: 1 }, name: 'room_1_createdAt_1', unique: false },
    ]);
    await adapter.createIndexes(
      'User',
      [
        {
          fields: ['room', 'createdAt'],
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      'chat',
    );
    expect(createIndex).not.toHaveBeenCalled();
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes[0].name).toBe('room_1_createdAt_1');
  });

  it('throws on unique-data collisions and does not persist that index', async () => {
    const { adapter, createIndex, findByIdAndUpdate } = makeMongooseAdapter();
    createIndex.mockRejectedValue({ code: 11000, message: 'E11000 duplicate key' });
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], options: { unique: true } }],
        'chat',
      ),
    ).rejects.toMatchObject({ code: status.INTERNAL });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('persists the prefix and publishes after a later unique-data failure', async () => {
    const { adapter, createIndex, findByIdAndUpdate, publish } = makeMongooseAdapter();
    createIndex
      .mockResolvedValueOnce('cnd_idx_email_asc')
      .mockRejectedValueOnce({ code: 11000, message: 'E11000 duplicate key' });
    await expect(
      adapter.createIndexes(
        'User',
        [
          { fields: ['email'], types: [CompatibleIndexType.Ascending] },
          { fields: ['room'], options: { unique: true } },
        ],
        'chat',
      ),
    ).rejects.toMatchObject({ code: status.INTERNAL });
    expect(findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes.map(index => index.name)).toEqual([
      'cnd_idx_email_asc',
    ]);
    expect(publish).toHaveBeenCalledWith('database:create:schema', expect.any(String));
  });

  it('overlays declared Compatible types onto a live index by fields', async () => {
    const { adapter, indexes, originalSchema } = makeMongooseAdapter();
    originalSchema.modelOptions.indexes = [
      {
        fields: ['room', 'createdAt'],
        name: 'cnd_idx_room_createdAt_asc_asc',
        types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
      },
    ];
    indexes.mockResolvedValue([
      { v: 2, key: { _id: 1 }, name: '_id_' },
      { v: 2, key: { room: 1, createdAt: 1 }, name: 'room_1_createdAt_1', unique: false },
    ]);
    const result = await adapter.getIndexes('User');
    expect(result[1].name).toBe('room_1_createdAt_1');
    expect(result[1].types).toEqual([
      CompatibleIndexType.Ascending,
      CompatibleIndexType.Ascending,
    ]);
  });

  it('publishes the schema after a successful persist', async () => {
    const { adapter, publish } = makeMongooseAdapter();
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'chat',
    );
    expect(publish).toHaveBeenCalledWith('database:create:schema', expect.any(String));
  });

  it('throws on a name-already-exists error when the live name indexes different fields', async () => {
    const { adapter, createIndex, indexes, findByIdAndUpdate } = makeMongooseAdapter();
    createIndex.mockRejectedValue({ message: 'index user_idx already exists' });
    indexes
      .mockResolvedValueOnce([{ v: 2, key: { _id: 1 }, name: '_id_' }])
      .mockResolvedValueOnce([
        { v: 2, key: { _id: 1 }, name: '_id_' },
        { v: 2, key: { room: 1 }, name: 'user_idx', unique: false },
      ]);
    await expect(
      adapter.createIndexes('User', [{ fields: ['email'], name: 'user_idx' }], 'chat'),
    ).rejects.toMatchObject({ code: status.INTERNAL });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rebinds to the live name on Mongo 86 instead of persisting a generated name', async () => {
    const { adapter, createIndex, indexes, findByIdAndUpdate } = makeMongooseAdapter();
    createIndex.mockRejectedValue({ code: 86, message: 'IndexKeySpecsConflict' });
    indexes
      .mockResolvedValueOnce([{ v: 2, key: { _id: 1 }, name: '_id_' }])
      .mockResolvedValueOnce([
        { v: 2, key: { _id: 1 }, name: '_id_' },
        { v: 2, key: { email: 1 }, name: 'email_1', unique: false },
      ]);
    await adapter.createIndexes(
      'User',
      [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
      'chat',
    );
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes[0].name).toBe('email_1');
  });

  it('persists only names that were actually dropped', async () => {
    const { adapter, dropIndex, findByIdAndUpdate } = makeMongooseAdapter({
      originalSchema: {
        modelOptions: {
          indexes: [
            { fields: ['email'], name: 'idx_a' },
            { fields: ['room'], name: 'idx_b' },
          ],
        },
      },
    });
    dropIndex
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('missing'));
    await expect(adapter.deleteIndexes('User', ['idx_a', 'idx_b'])).rejects.toMatchObject(
      {
        code: status.INTERNAL,
      },
    );
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes.map(index => index.name)).toEqual(['idx_b']);
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
    showIndex.mockResolvedValue([
      {
        name: 'cnd_idx_email_asc',
        unique: false,
        fields: [{ attribute: 'email', order: 'ASC' }],
        definition: 'CREATE INDEX cnd_idx_email_asc ON custom_users USING btree (email)',
      },
    ]);
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

  it('adopts a live compound name and skips addIndex', async () => {
    const { adapter, addIndex, showIndex, findByIdAndUpdate } = makeSequelizeAdapter();
    showIndex.mockResolvedValue([
      {
        name: 'room_createdAt',
        unique: false,
        fields: [{ attribute: 'room' }, { attribute: 'createdAt' }],
      },
    ]);
    await adapter.createIndexes(
      'User',
      [
        {
          fields: ['room', 'createdAt'],
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      'database',
    );
    expect(addIndex).not.toHaveBeenCalled();
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes[0].name).toBe('room_createdAt');
  });

  it('skips and persists on 42P07 when the live name has the same identity', async () => {
    const { adapter, addIndex, showIndex, findByIdAndUpdate, publish } =
      makeSequelizeAdapter();
    showIndex.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        name: 'cnd_idx_email_asc',
        unique: false,
        fields: [{ attribute: 'email', order: 'ASC' }],
      },
    ]);
    addIndex.mockRejectedValue({
      original: { code: '42P07', message: 'relation "cnd_idx_email_asc" already exists' },
    });
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
        'database',
      ),
    ).resolves.toBe('Indexes created!');
    expect(findByIdAndUpdate).toHaveBeenCalled();
    expect(publish).toHaveBeenCalled();
  });

  it('throws on 42P07 when the live name indexes different fields', async () => {
    const { adapter, addIndex, showIndex, findByIdAndUpdate } = makeSequelizeAdapter();
    showIndex.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        name: 'user_idx',
        unique: false,
        fields: [{ attribute: 'room' }],
      },
    ]);
    addIndex.mockRejectedValue({
      original: { code: '42P07', message: 'relation "user_idx" already exists' },
    });
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], name: 'user_idx' }],
        'database',
      ),
    ).rejects.toMatchObject({ code: status.INTERNAL });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('persists the applied prefix when a later 42P07 name has different fields', async () => {
    const { adapter, addIndex, showIndex, findByIdAndUpdate, publish } =
      makeSequelizeAdapter();
    showIndex.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        name: 'user_idx',
        unique: false,
        fields: [{ attribute: 'username' }],
      },
    ]);
    addIndex.mockResolvedValueOnce(undefined).mockRejectedValueOnce({
      original: { code: '42P07', message: 'relation "user_idx" already exists' },
    });
    await expect(
      adapter.createIndexes(
        'User',
        [
          { fields: ['email'], types: [CompatibleIndexType.Ascending] },
          { fields: ['room'], name: 'user_idx' },
        ],
        'database',
      ),
    ).rejects.toMatchObject({ code: status.INTERNAL });
    expect(findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const update = findByIdAndUpdate.mock.calls[0][1] as {
      modelOptions: { indexes: { name?: string }[] };
    };
    expect(update.modelOptions.indexes.map(index => index.name)).toEqual([
      'cnd_idx_email_asc',
    ]);
    expect(publish).toHaveBeenCalled();
  });

  it('throws on 23505 unique collisions and does not persist that index', async () => {
    const { adapter, addIndex, findByIdAndUpdate } = makeSequelizeAdapter();
    addIndex.mockRejectedValue({
      name: 'SequelizeUniqueConstraintError',
      original: { code: '23505' },
    });
    await expect(
      adapter.createIndexes(
        'User',
        [{ fields: ['email'], options: { unique: true } }],
        'database',
        { privileged: true },
      ),
    ).rejects.toMatchObject({ code: status.INTERNAL });
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('overlays declared Compatible types onto a live SQL index by fields', async () => {
    const { adapter, showIndex, originalSchema } = makeSequelizeAdapter();
    originalSchema.modelOptions.indexes = [
      {
        fields: ['room', 'createdAt'],
        name: 'cnd_idx_room_createdAt_asc_asc',
        types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
      },
    ];
    showIndex.mockResolvedValue([
      {
        name: 'room_createdAt',
        unique: false,
        fields: [{ attribute: 'room' }, { attribute: 'createdAt' }],
        definition:
          'CREATE INDEX room_createdAt ON custom_users USING btree (room, createdAt)',
      },
    ]);
    const result = await adapter.getIndexes('User');
    expect(result[0].name).toBe('room_createdAt');
    expect(result[0].types).toEqual([
      CompatibleIndexType.Ascending,
      CompatibleIndexType.Ascending,
    ]);
  });
});
