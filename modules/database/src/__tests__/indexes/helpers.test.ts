import { describe, expect, it } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import {
  CompatibleIndexType,
  MongoIndexType,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import {
  assertUniqueIndexPrivilege,
  bindDeclaredIndexesToLive,
  collectExistingIndexNames,
  ensureIndexName,
  generateIndexName,
  indexIdentity,
  isCompatibleIndexType,
  isIndexAlreadyExistsError,
  isMongoIndexType,
  keepDeclaredIndexExtras,
  liveNameConflictAllowsReuse,
  mapCompatibleToMongo,
  mapCompatibleToSqlOrder,
  mergeDeclaredIndexes,
  mongoAllowsIndexType,
  overlayDeclaredOnLive,
  persistDeclaredSchemaIndexes,
  removeDeclaredIndexes,
  removeIndexFromSchemaFields,
  resolveIndexName,
  sqlDialectAllowsIndexType,
  sqlIndexFields,
  validateIndexFields,
} from '../../adapters/utils/indexes.js';

describe('index helpers', () => {
  it('keeps CompatibleIndexType as portable strings, not Mongo 1/-1', () => {
    expect(CompatibleIndexType.Ascending).toBe('Ascending');
    expect(CompatibleIndexType.Descending).toBe('Descending');
    expect(CompatibleIndexType.Ascending).not.toBe(MongoIndexType.Ascending);
    expect(isCompatibleIndexType(CompatibleIndexType.Ascending)).toBe(true);
    expect(isCompatibleIndexType(1)).toBe(false);
    expect(isMongoIndexType('Ascending')).toBe(false);
  });

  it('generates a deterministic name when one is missing', () => {
    const name = generateIndexName(['email'], [CompatibleIndexType.Ascending], false);
    expect(name).toBe('cnd_idx_email_asc');
    const unique = generateIndexName(
      ['room', 'createdAt'],
      [CompatibleIndexType.Ascending, CompatibleIndexType.Descending],
      true,
    );
    expect(unique).toBe(
      generateIndexName(
        ['room', 'createdAt'],
        [CompatibleIndexType.Ascending, CompatibleIndexType.Descending],
        true,
      ),
    );
    expect(unique).toMatch(/^cnd_uidx_/);
  });

  it('keeps a provided name on the index and options', () => {
    const named = ensureIndexName({
      fields: ['email'],
      name: 'custom_email_idx',
    });
    expect(resolveIndexName(named)).toBe('custom_email_idx');
    expect(named.options?.name).toBe('custom_email_idx');
  });

  it('maps Compatible and Mongo directions to engine types', () => {
    expect(mapCompatibleToMongo(CompatibleIndexType.Ascending)).toBe(1);
    expect(mapCompatibleToMongo(CompatibleIndexType.Descending)).toBe(-1);
    expect(mapCompatibleToMongo(undefined)).toBe(1);
    expect(mapCompatibleToSqlOrder(CompatibleIndexType.Ascending)).toBe('ASC');
    expect(mapCompatibleToSqlOrder(CompatibleIndexType.Descending)).toBe('DESC');
    expect(sqlIndexFields({ fields: ['createdAt', 'room'] })).toEqual([
      'createdAt',
      'room',
    ]);
    expect(
      sqlIndexFields({
        fields: ['createdAt', 'room'],
        types: [CompatibleIndexType.Descending, CompatibleIndexType.Ascending],
      }),
    ).toEqual([
      { name: 'createdAt', order: 'DESC' },
      { name: 'room', order: 'ASC' },
    ]);
    expect(
      sqlIndexFields({
        fields: ['createdAt'],
        types: [MongoIndexType.Descending],
      }),
    ).toEqual([{ name: 'createdAt', order: 'DESC' }]);
  });

  it('preserves unique when generating a name', () => {
    const unique = ensureIndexName({
      fields: ['email'],
      types: [CompatibleIndexType.Ascending],
      options: { unique: true },
    });
    expect(unique.options?.unique).toBe(true);
    expect(resolveIndexName(unique)).toMatch(/uidx/);
  });

  it('merges declared indexes by name without overwriting the first', () => {
    const merged = mergeDeclaredIndexes(
      [{ fields: ['a'], name: 'idx_a' }],
      [
        { fields: ['a'], name: 'idx_a', options: { unique: true } },
        { fields: ['b'], name: 'idx_b' },
      ],
    );
    expect(merged.map(index => index.name)).toEqual(['idx_a', 'idx_b']);
    expect(merged[0].options?.unique).toBeUndefined();
  });

  it('removes declared indexes and field-level index metadata by name', () => {
    expect(
      removeDeclaredIndexes(
        [
          { fields: ['a'], name: 'idx_a' },
          { fields: ['b'], name: 'idx_b' },
        ],
        ['idx_a'],
      ),
    ).toEqual([{ fields: ['b'], name: 'idx_b' }]);
    expect(
      removeIndexFromSchemaFields({ fields: { a: { index: { name: 'x' } } } }, 'x'),
    ).toBe(true);
  });

  it('rejects unknown index fields', () => {
    expect(() =>
      validateIndexFields(
        { compiledFields: { email: 'String' }, fields: {} },
        { fields: ['missing'] },
      ),
    ).toThrow(/Invalid fields/);
  });

  it('enforces unique-index privilege for owner, Admin, and import', () => {
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'database',
        privileged: false,
      }),
    ).toThrow(expect.objectContaining({ code: status.PERMISSION_DENIED }));
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'chat',
        privileged: false,
      }),
    ).not.toThrow();
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'database',
        privileged: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'authorization',
        callerModule: 'database',
        privileged: false,
      }),
    ).toThrow(/Not authorized to create unique index/);
  });

  it('collects existing names and detects name/relation already-exists errors only', () => {
    expect(
      collectExistingIndexNames([{ fields: ['a'], options: { name: 'idx_a' } }]).has(
        'idx_a',
      ),
    ).toBe(true);
    expect(
      isIndexAlreadyExistsError({
        code: '42P07',
        message: 'relation "x" already exists',
      }),
    ).toBe(true);
    expect(
      isIndexAlreadyExistsError({ code: '1061', message: "Duplicate key name 'x'" }),
    ).toBe(true);
    expect(
      isIndexAlreadyExistsError({
        original: { code: '42P07', message: 'relation "idx" already exists' },
      }),
    ).toBe(true);
    expect(isIndexAlreadyExistsError(new Error('index foo already exists'))).toBe(true);
    expect(isIndexAlreadyExistsError(new Error('already exists'))).toBe(false);
    expect(
      isIndexAlreadyExistsError({ code: 11000, message: 'E11000 duplicate key' }),
    ).toBe(false);
    expect(
      isIndexAlreadyExistsError({
        name: 'SequelizeUniqueConstraintError',
        original: { code: '23505' },
      }),
    ).toBe(false);
    expect(
      isIndexAlreadyExistsError({
        code: 85,
        message: 'Index with name: x already exists',
      }),
    ).toBe(false);
    expect(
      isIndexAlreadyExistsError({
        code: 86,
        message: 'Index already exists with different options',
      }),
    ).toBe(false);
  });

  it('binds unnamed declared indexes to live names by fields+unique', () => {
    const bound = bindDeclaredIndexesToLive(
      [
        {
          fields: ['room', 'createdAt'],
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      [
        {
          name: '_id_',
          fields: ['_id'],
          options: { name: '_id_' },
        },
        {
          name: 'room_1_createdAt_1',
          fields: ['room', 'createdAt'],
          options: { name: 'room_1_createdAt_1', unique: false },
        },
      ],
    );
    expect(resolveIndexName(bound[0])).toBe('room_1_createdAt_1');
    expect(indexIdentity(bound[0])).toEqual({
      fields: ['room', 'createdAt'],
      unique: false,
    });
  });

  it('treats unique vs non-unique as different identities', () => {
    const bound = bindDeclaredIndexesToLive(
      [{ fields: ['email'], options: { unique: true } }],
      [
        {
          name: 'email_1',
          fields: ['email'],
          options: { name: 'email_1', unique: false },
        },
      ],
    );
    expect(resolveIndexName(bound[0])).not.toBe('email_1');
    expect(resolveIndexName(bound[0])).toMatch(/uidx/);
  });

  it('keeps Admin extras and drops stale generated names for the same identity', () => {
    const unioned = keepDeclaredIndexExtras(
      [
        {
          fields: ['room', 'createdAt'],
          name: 'room_1_createdAt_1',
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
      [
        {
          fields: ['room', 'createdAt'],
          name: 'cnd_idx_room_createdAt_asc_asc',
        },
        { fields: ['email'], name: 'admin_email_idx' },
      ],
    );
    expect(unioned.map(index => index.name)).toEqual([
      'room_1_createdAt_1',
      'admin_email_idx',
    ]);
  });

  it('overlays declared Compatible types onto live indexes by identity when names differ', () => {
    const overlaid = overlayDeclaredOnLive(
      {
        name: 'room_1_createdAt_1',
        fields: ['room', 'createdAt'],
        types: [MongoIndexType.Ascending, MongoIndexType.Ascending],
        options: { name: 'room_1_createdAt_1' },
      },
      [
        {
          fields: ['room', 'createdAt'],
          name: 'cnd_idx_room_createdAt_asc_asc',
          types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
        },
      ],
    );
    expect(overlaid.types).toEqual([
      CompatibleIndexType.Ascending,
      CompatibleIndexType.Ascending,
    ]);
    expect(overlaid.name).toBe('room_1_createdAt_1');
  });

  it('persists applied indexes against a re-read declared schema list', async () => {
    let findOneOptions: unknown;
    const findOne = async (_query: Record<string, unknown>, options?: unknown) => {
      findOneOptions = options;
      return {
        _id: 'declared-1',
        modelOptions: { indexes: [{ fields: ['keep'], name: 'keep_me' }] },
      };
    };
    const findByIdAndUpdate = async () => ({});
    const originalSchema = {
      modelOptions: { indexes: [] as { fields: string[]; name?: string }[] },
    };
    const persisted = await persistDeclaredSchemaIndexes({
      declaredSchemaModel: { findOne, findByIdAndUpdate },
      schemaName: 'User',
      originalSchema,
      applied: [{ fields: ['email'], name: 'cnd_idx_email_asc' }],
    });
    expect(persisted).toBe(true);
    expect(findOneOptions).toEqual({ readPreference: 'primary' });
    expect(originalSchema.modelOptions.indexes.map(index => index.name)).toEqual([
      'keep_me',
      'cnd_idx_email_asc',
    ]);
  });

  it('reuses a live name-conflict only when identity matches', () => {
    const live = [
      {
        name: 'user_idx',
        fields: ['email'],
        options: { name: 'user_idx', unique: false },
      },
    ];
    expect(
      liveNameConflictAllowsReuse(
        { name: 'user_idx', fields: ['email'], options: { name: 'user_idx' } },
        live,
      ),
    ).toBe(true);
    expect(
      liveNameConflictAllowsReuse(
        { name: 'user_idx', fields: ['username'], options: { name: 'user_idx' } },
        live,
      ),
    ).toBe(false);
    expect(
      liveNameConflictAllowsReuse(
        {
          name: 'user_idx',
          fields: ['email'],
          options: { name: 'user_idx', unique: true },
        },
        live,
      ),
    ).toBe(false);
    expect(
      liveNameConflictAllowsReuse(
        { name: 'user_idx', fields: ['email'], options: { name: 'user_idx' } },
        [],
      ),
    ).toBe(false);
  });

  it('allows dialect-native types and rejects foreign leftovers', () => {
    expect(sqlDialectAllowsIndexType('mysql', CompatibleIndexType.Ascending)).toBe(true);
    expect(sqlDialectAllowsIndexType('mariadb', CompatibleIndexType.Descending)).toBe(
      true,
    );
    expect(sqlDialectAllowsIndexType('sqlite', PostgresIndexType.BTREE)).toBe(true);
    expect(sqlDialectAllowsIndexType('sqlite', PostgresIndexType.HASH)).toBe(false);
    expect(sqlDialectAllowsIndexType('mysql', PostgresIndexType.GIST)).toBe(false);
    expect(sqlDialectAllowsIndexType('postgres', PostgresIndexType.GIN)).toBe(true);
    expect(mongoAllowsIndexType(CompatibleIndexType.Ascending)).toBe(true);
    expect(mongoAllowsIndexType(PostgresIndexType.BTREE)).toBe(false);
  });
});
