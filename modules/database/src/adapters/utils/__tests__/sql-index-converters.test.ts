import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CompatibleIndexType,
  ConduitGrpcSdk,
  ConduitSchema,
  MongoIndexType,
  PostgresIndexType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  convertModelOptionsIndexes,
  convertSchemaFieldIndexes,
} from '../database-transform-utils.js';
import { sqlSchemaConverter } from '../../sequelize-adapter/sql-adapter/SqlSchemaConverter.js';
import { pgSchemaConverter } from '../../sequelize-adapter/postgres-adapter/PgSchemaConverter.js';

function schemaWithIndexes(
  indexes: ConduitSchema['modelOptions']['indexes'],
  fields: ConduitSchema['fields'] = { email: { type: TYPE.String } },
) {
  return new ConduitSchema('User', fields as any, { indexes });
}

describe('SQL dialect-aware converters T17–T24', () => {
  beforeEach(() => {
    jest.spyOn(ConduitGrpcSdk.Logger, 'warn').mockImplementation(() => {});
  });

  it('T18 postgres maps Compatible to BTREE + ASC/DESC', () => {
    const copy = convertModelOptionsIndexes(
      schemaWithIndexes([
        {
          fields: ['email'],
          types: [CompatibleIndexType.Descending],
        },
      ]),
      'postgres',
    );
    const index = copy.modelOptions.indexes![0] as any;
    expect(index.using).toBe(PostgresIndexType.BTREE);
    expect(index.fields[0]).toEqual({ name: 'email', order: 'DESC' });
  });

  it('T19 mysql maps Compatible to BTREE + ASC', () => {
    const copy = convertModelOptionsIndexes(
      schemaWithIndexes([{ fields: ['email'], types: [CompatibleIndexType.Ascending] }]),
      'mysql',
    );
    const index = copy.modelOptions.indexes![0] as any;
    expect(index.using).toBe(PostgresIndexType.BTREE);
    expect(index.fields[0]).toEqual({ name: 'email', order: 'ASC' });
  });

  it('T20 sqlite maps Compatible to BTREE + ASC', () => {
    const copy = convertModelOptionsIndexes(
      schemaWithIndexes([{ fields: ['email'], types: CompatibleIndexType.Ascending }]),
      'sqlite',
    );
    const index = copy.modelOptions.indexes![0] as any;
    expect(index.using).toBe(PostgresIndexType.BTREE);
  });

  it('T21 recover: Mongo-only leftovers on SQL are warned and skipped', () => {
    const warn = ConduitGrpcSdk.Logger.warn as jest.Mock;
    const copy = convertModelOptionsIndexes(
      schemaWithIndexes([
        { fields: ['loc'], types: [MongoIndexType.GeoSpatial2dSphere] },
        { fields: ['email'], types: [CompatibleIndexType.Ascending] },
      ]),
      'postgres',
    );
    expect(copy.modelOptions.indexes).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });

  it('T22 recover: postgres-only types on mysql/mariadb/sqlite are skipped', () => {
    for (const dialect of ['mysql', 'mariadb', 'sqlite'] as const) {
      const copy = convertModelOptionsIndexes(
        schemaWithIndexes([{ fields: ['email'], types: PostgresIndexType.GIST }]),
        dialect,
      );
      expect(copy.modelOptions.indexes).toHaveLength(0);
    }
  });

  it('converts field-level Compatible indexes into sequelize model indexes', () => {
    const copy = convertSchemaFieldIndexes(
      new ConduitSchema(
        'Perm',
        {
          resource: {
            type: TYPE.String,
            index: { type: CompatibleIndexType.Ascending },
          },
        } as any,
        {},
      ),
      'mysql',
    );
    expect(copy.modelOptions.indexes).toHaveLength(1);
    expect((copy.fields.resource as any).index).toBeUndefined();
  });

  it('sqlSchemaConverter is dialect-aware for mysql vs sqlite', () => {
    const schema = new ConduitSchema('User', { email: { type: TYPE.String } } as any, {
      indexes: [
        { fields: ['email'], types: [CompatibleIndexType.Descending] },
        { fields: ['email'], types: PostgresIndexType.HASH },
      ],
    });
    const [mysql] = sqlSchemaConverter(schema, 'mysql');
    const [sqlite] = sqlSchemaConverter(schema, 'sqlite');
    expect(mysql.modelOptions.indexes).toHaveLength(2);
    expect(sqlite.modelOptions.indexes).toHaveLength(1);
  });

  it('pgSchemaConverter keeps postgres-only types', () => {
    const schema = new ConduitSchema('User', { email: { type: TYPE.String } } as any, {
      indexes: [{ fields: ['email'], types: PostgresIndexType.GIN }],
    });
    const [pg] = pgSchemaConverter(schema);
    expect(pg.modelOptions.indexes).toHaveLength(1);
    expect((pg.modelOptions.indexes![0] as any).using).toBe(PostgresIndexType.GIN);
  });
});
