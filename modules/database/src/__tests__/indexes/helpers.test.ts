import { describe, expect, it } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import {
  CompatibleIndexType,
  MongoIndexType,
  PostgresIndexType,
} from '@conduitplatform/grpc-sdk';
import {
  assertUniqueIndexPrivilege,
  collectExistingIndexNames,
  ensureIndexName,
  generateIndexName,
  isCompatibleIndexType,
  isIndexAlreadyExistsError,
  isMongoIndexType,
  mapCompatibleToMongo,
  mapCompatibleToSqlOrder,
  mergeDeclaredIndexes,
  mongoAllowsIndexType,
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

  it('collects existing names and detects already-exists errors', () => {
    expect(
      collectExistingIndexNames([{ fields: ['a'], options: { name: 'idx_a' } }]).has(
        'idx_a',
      ),
    ).toBe(true);
    expect(isIndexAlreadyExistsError(new Error('index already exists'))).toBe(true);
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
