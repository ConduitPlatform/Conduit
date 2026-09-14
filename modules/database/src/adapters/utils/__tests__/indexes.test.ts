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
} from '../indexes.js';

describe('index helpers T1–T16', () => {
  it('T1 CompatibleIndexType uses portable string values, not Mongo 1/-1', () => {
    expect(CompatibleIndexType.Ascending).toBe('Ascending');
    expect(CompatibleIndexType.Descending).toBe('Descending');
    expect(CompatibleIndexType.Ascending).not.toBe(MongoIndexType.Ascending);
    expect(isCompatibleIndexType(CompatibleIndexType.Ascending)).toBe(true);
    expect(isCompatibleIndexType(1)).toBe(false);
    expect(isMongoIndexType('Ascending')).toBe(false);
  });

  it('T4 generates a name when missing', () => {
    const name = generateIndexName(['email'], [CompatibleIndexType.Ascending], false);
    expect(name).toMatch(/^cnd_idx_email_asc$/);
  });

  it('T5 keeps a provided name', () => {
    const named = ensureIndexName({
      fields: ['email'],
      name: 'custom_email_idx',
    });
    expect(resolveIndexName(named)).toBe('custom_email_idx');
    expect(named.options?.name).toBe('custom_email_idx');
  });

  it('T6 is deterministic for the same input', () => {
    const a = generateIndexName(
      ['room', 'createdAt'],
      [CompatibleIndexType.Ascending, CompatibleIndexType.Descending],
      true,
    );
    const b = generateIndexName(
      ['room', 'createdAt'],
      [CompatibleIndexType.Ascending, CompatibleIndexType.Descending],
      true,
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^cnd_uidx_/);
  });

  it('T7 maps Compatible to Mongo 1/-1', () => {
    expect(mapCompatibleToMongo(CompatibleIndexType.Ascending)).toBe(1);
    expect(mapCompatibleToMongo(CompatibleIndexType.Descending)).toBe(-1);
    expect(mapCompatibleToMongo(undefined)).toBe(1);
  });

  it('T8 maps Compatible to SQL BTREE ASC/DESC field order', () => {
    expect(mapCompatibleToSqlOrder(CompatibleIndexType.Ascending)).toBe('ASC');
    expect(mapCompatibleToSqlOrder(CompatibleIndexType.Descending)).toBe('DESC');
    const fields = sqlIndexFields({
      fields: ['createdAt', 'room'],
      types: [CompatibleIndexType.Descending, CompatibleIndexType.Ascending],
    });
    expect(fields).toEqual([
      { name: 'createdAt', order: 'DESC' },
      { name: 'room', order: 'ASC' },
    ]);
  });

  it('T9 preserves the unique option on generated names', () => {
    const unique = ensureIndexName({
      fields: ['email'],
      types: [CompatibleIndexType.Ascending],
      options: { unique: true },
    });
    expect(unique.options?.unique).toBe(true);
    expect(resolveIndexName(unique)).toMatch(/uidx/);
  });

  it('T10 persist helper merges incoming indexes by name and skips duplicates', () => {
    const merged = mergeDeclaredIndexes(
      [{ fields: ['a'], name: 'idx_a' }],
      [
        { fields: ['a'], name: 'idx_a', options: { unique: true } },
        { fields: ['b'], name: 'idx_b' },
      ],
    );
    expect(merged.map(i => i.name)).toEqual(['idx_a', 'idx_b']);
    expect(merged[0].options?.unique).toBeUndefined();
  });

  it('T11 persist helper removes indexes by name', () => {
    const remaining = removeDeclaredIndexes(
      [
        { fields: ['a'], name: 'idx_a' },
        { fields: ['b'], name: 'idx_b' },
      ],
      ['idx_a'],
    );
    expect(remaining).toEqual([{ fields: ['b'], name: 'idx_b' }]);
  });

  it('T12 validateIndexFields rejects unknown fields', () => {
    expect(() =>
      validateIndexFields(
        { compiledFields: { email: 'String' }, fields: {} },
        {
          fields: ['missing'],
        },
      ),
    ).toThrow(/Invalid fields/);
  });

  it('T13 unique is denied for a non-owner, non-admin caller', () => {
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'database',
        privileged: false,
      }),
    ).toThrow(expect.objectContaining({ code: status.PERMISSION_DENIED }));
  });

  it('T14 unique is allowed for the schema owner', () => {
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'chat',
        privileged: false,
      }),
    ).not.toThrow();
  });

  it('T15 unique is allowed for privileged Admin', () => {
    expect(() =>
      assertUniqueIndexPrivilege({
        unique: true,
        schemaOwner: 'chat',
        callerModule: 'database',
        privileged: true,
      }),
    ).not.toThrow();
  });

  it('T16 import unique respects owner privilege (not Admin-privileged)', () => {
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
    expect(
      removeIndexFromSchemaFields({ fields: { a: { index: { name: 'x' } } } }, 'x'),
    ).toBe(true);
  });

  it('T25 dialect checks use real switches, not `mysql || mariadb`', () => {
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
