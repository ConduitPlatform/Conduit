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
} from '../../adapters/utils/database-transform-utils.js';
import { sqlSchemaConverter } from '../../adapters/sequelize-adapter/sql-adapter/SqlSchemaConverter.js';
import { pgSchemaConverter } from '../../adapters/sequelize-adapter/postgres-adapter/PgSchemaConverter.js';
import { schemaConverter } from '../../adapters/mongoose-adapter/SchemaConverter.js';

type ConvertedSqlIndex = {
  fields: Array<string | { name: string; order: 'ASC' | 'DESC' }>;
  using?: PostgresIndexType;
};

function schemaWithIndexes(
  indexes: ConduitSchema['modelOptions']['indexes'],
  fields: ConduitSchema['fields'] = { email: { type: TYPE.String } },
) {
  return new ConduitSchema('User', fields, { indexes });
}

describe('SQL index converters', () => {
  beforeEach(() => {
    jest.spyOn(ConduitGrpcSdk.Logger, 'warn').mockImplementation(() => undefined);
  });

  it('maps Compatible types to BTREE plus ASC/DESC on postgres and mysql', () => {
    const postgres = convertModelOptionsIndexes(
      schemaWithIndexes([{ fields: ['email'], types: [CompatibleIndexType.Descending] }]),
      'postgres',
    );
    const pgIndex = postgres.modelOptions.indexes![0] as ConvertedSqlIndex;
    expect(pgIndex.using).toBe(PostgresIndexType.BTREE);
    expect(pgIndex.fields[0]).toEqual({ name: 'email', order: 'DESC' });

    const mysql = convertModelOptionsIndexes(
      schemaWithIndexes([{ fields: ['email'], types: [CompatibleIndexType.Ascending] }]),
      'mysql',
    );
    const mysqlIndex = mysql.modelOptions.indexes![0] as ConvertedSqlIndex;
    expect(mysqlIndex.using).toBe(PostgresIndexType.BTREE);
    expect(mysqlIndex.fields[0]).toEqual({ name: 'email', order: 'ASC' });
  });

  it('maps Compatible types to BTREE on sqlite', () => {
    const copy = convertModelOptionsIndexes(
      schemaWithIndexes([{ fields: ['email'], types: CompatibleIndexType.Ascending }]),
      'sqlite',
    );
    expect((copy.modelOptions.indexes![0] as ConvertedSqlIndex).using).toBe(
      PostgresIndexType.BTREE,
    );
  });

  it('warns and skips Mongo-only leftovers on SQL', () => {
    const warn = ConduitGrpcSdk.Logger.warn as jest.Mock;
    const copy = convertModelOptionsIndexes(
      schemaWithIndexes(
        [
          { fields: ['loc'], types: [MongoIndexType.GeoSpatial2dSphere] },
          { fields: ['email'], types: [CompatibleIndexType.Ascending] },
        ],
        { email: { type: TYPE.String }, loc: { type: TYPE.JSON } },
      ),
      'postgres',
    );
    expect(copy.modelOptions.indexes).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });

  it('skips postgres-only types on mysql, mariadb, and sqlite', () => {
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
        },
        {},
      ),
      'mysql',
    );
    expect(copy.modelOptions.indexes).toHaveLength(1);
    expect((copy.fields.resource as { index?: unknown }).index).toBeUndefined();
  });

  it('keeps HASH on mysql and drops it on sqlite', () => {
    const schema = new ConduitSchema(
      'User',
      { email: { type: TYPE.String } },
      {
        indexes: [
          { fields: ['email'], types: [CompatibleIndexType.Descending] },
          { fields: ['email'], types: PostgresIndexType.HASH },
        ],
      },
    );
    const [mysql] = sqlSchemaConverter(schema, 'mysql');
    const [sqlite] = sqlSchemaConverter(schema, 'sqlite');
    expect(mysql.modelOptions.indexes).toHaveLength(2);
    expect(sqlite.modelOptions.indexes).toHaveLength(1);
  });

  it('keeps postgres-only types in the pg converter', () => {
    const schema = new ConduitSchema(
      'User',
      { email: { type: TYPE.String } },
      {
        indexes: [{ fields: ['email'], types: PostgresIndexType.GIN }],
      },
    );
    const [pg] = pgSchemaConverter(schema);
    expect(pg.modelOptions.indexes).toHaveLength(1);
    expect((pg.modelOptions.indexes![0] as ConvertedSqlIndex).using).toBe(
      PostgresIndexType.GIN,
    );
  });

  it('gives distinct generated names to two schemas with the same fields', () => {
    const permission = convertModelOptionsIndexes(
      new ConduitSchema(
        'Permission',
        { resource: { type: TYPE.String } },
        { indexes: [{ fields: ['resource'], types: [CompatibleIndexType.Ascending] }] },
      ),
      'postgres',
    );
    const relationship = convertModelOptionsIndexes(
      new ConduitSchema(
        'Relationship',
        { resource: { type: TYPE.String } },
        { indexes: [{ fields: ['resource'], types: [CompatibleIndexType.Ascending] }] },
      ),
      'postgres',
    );
    expect((permission.modelOptions.indexes![0] as { name?: string }).name).toBe(
      'cnd_idx_Permission_resource_asc',
    );
    expect((relationship.modelOptions.indexes![0] as { name?: string }).name).toBe(
      'cnd_idx_Relationship_resource_asc',
    );
  });

  it('skips MySQL JSON field-level indexes and keeps them on postgres', () => {
    const mysql = convertSchemaFieldIndexes(
      new ConduitSchema(
        'ObjectIndex',
        {
          inheritanceTree: {
            type: [TYPE.String],
            index: { type: CompatibleIndexType.Ascending },
          },
        },
        {},
      ),
      'mysql',
    );
    const postgres = convertSchemaFieldIndexes(
      new ConduitSchema(
        'ObjectIndex',
        {
          inheritanceTree: {
            type: [TYPE.String],
            index: { type: CompatibleIndexType.Ascending },
          },
        },
        {},
      ),
      'postgres',
    );
    expect(mysql.modelOptions.indexes).toHaveLength(0);
    expect(postgres.modelOptions.indexes).toHaveLength(1);
  });

  it('skips extracted array-relation indexes on SQL and relation-field compounds', () => {
    const chatRoom = new ConduitSchema(
      'ChatRoom',
      {
        participants: [{ type: TYPE.Relation, model: 'User', required: true }],
        deleted: { type: TYPE.Boolean },
      },
      {
        timestamps: true,
        indexes: [
          { fields: ['participants'], types: [CompatibleIndexType.Ascending] },
          {
            fields: ['participants', 'deleted'],
            types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
          },
        ],
      },
    );
    const [mysql] = sqlSchemaConverter(chatRoom, 'mysql');
    const [pg] = pgSchemaConverter(chatRoom);
    expect(mysql.modelOptions.indexes ?? []).toHaveLength(0);
    expect(pg.modelOptions.indexes ?? []).toHaveLength(0);

    const message = new ConduitSchema(
      'Message',
      {
        room: { type: TYPE.Relation, model: 'ChatRoom', required: true },
        deleted: { type: TYPE.Boolean },
        createdAt: { type: TYPE.Date },
      },
      {
        timestamps: true,
        indexes: [
          {
            fields: ['room', 'createdAt'],
            types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
          },
        ],
      },
    );
    const [mysqlMessage] = sqlSchemaConverter(message, 'mysql');
    const [pgMessage] = pgSchemaConverter(message);
    expect(mysqlMessage.modelOptions.indexes ?? []).toHaveLength(0);
    expect(pgMessage.modelOptions.indexes ?? []).toHaveLength(0);

    const scalar = new ConduitSchema(
      'Message',
      {
        deleted: { type: TYPE.Boolean },
        createdAt: { type: TYPE.Date },
      },
      {
        timestamps: true,
        indexes: [
          {
            fields: ['deleted', 'createdAt'],
            types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
          },
        ],
      },
    );
    const [mysqlScalar] = sqlSchemaConverter(scalar, 'mysql');
    const [pgScalar] = pgSchemaConverter(scalar);
    expect(mysqlScalar.modelOptions.indexes).toHaveLength(1);
    expect(pgScalar.modelOptions.indexes).toHaveLength(1);
  });
});

describe('mongoose SchemaConverter indexes', () => {
  beforeEach(() => {
    jest.spyOn(ConduitGrpcSdk.Logger, 'warn').mockImplementation(() => undefined);
  });

  it('treats Compatible types as Mongo 1/-1', () => {
    const converted = schemaConverter(
      new ConduitSchema(
        'User',
        {
          email: {
            type: TYPE.String,
            index: { type: CompatibleIndexType.Descending },
          },
        },
        {},
      ),
    );
    expect(
      (converted.fields.email as { index: { type: MongoIndexType } }).index.type,
    ).toBe(MongoIndexType.Descending);
  });

  it('warns and skips postgres leftovers on Mongo', () => {
    const warn = ConduitGrpcSdk.Logger.warn as jest.Mock;
    const converted = schemaConverter(
      new ConduitSchema(
        'User',
        {
          email: {
            type: TYPE.String,
            index: { type: PostgresIndexType.GIN },
          },
        },
        {},
      ),
    );
    expect((converted.fields.email as { index?: unknown }).index).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('maps the Compatible string Ascending, not a Mongo enum key', () => {
    const converted = schemaConverter(
      new ConduitSchema(
        'User',
        {
          email: {
            type: TYPE.String,
            index: { type: CompatibleIndexType.Ascending },
          },
        },
        {},
      ),
    );
    expect(
      (converted.fields.email as { index: { type: MongoIndexType } }).index.type,
    ).toBe(MongoIndexType.Ascending);
  });

  it('keeps single-field array indexes on modelOptions with compounds', () => {
    const converted = schemaConverter(
      new ConduitSchema(
        'ChatRoom',
        {
          participants: [{ type: TYPE.Relation, model: 'User', required: true }],
          deleted: { type: TYPE.Boolean },
        },
        {
          indexes: [
            { fields: ['participants'], types: [CompatibleIndexType.Ascending] },
            {
              fields: ['participants', 'deleted'],
              types: [CompatibleIndexType.Ascending, CompatibleIndexType.Ascending],
            },
          ],
        },
      ),
    );
    const remaining = converted.modelOptions.indexes ?? [];
    expect(remaining.map(index => index.fields)).toEqual([
      ['participants'],
      ['participants', 'deleted'],
    ]);
  });

  it('lifts field-level array Compatible indexes onto modelOptions', () => {
    const converted = schemaConverter(
      new ConduitSchema(
        'ObjectIndex',
        {
          inheritanceTree: {
            type: [TYPE.String],
            default: [],
            index: { type: CompatibleIndexType.Ascending },
          },
        },
        {},
      ),
    );
    expect(
      (converted.fields.inheritanceTree as { index?: unknown }).index,
    ).toBeUndefined();
    expect(converted.modelOptions.indexes?.map(index => index.fields)).toEqual([
      ['inheritanceTree'],
    ]);
  });
});
