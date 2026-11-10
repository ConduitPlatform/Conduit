import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { SequelizeAdapter } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';
import { createSequelize } from '../utils/sqlite.js';

// Every transaction on a file-backed SQLite database opens its own connection and
// SQLite has a single writer, so concurrent writers must wait for the lock instead of
// failing with SQLITE_BUSY. The Sequelize instance is built by the same helper the
// adapter uses, so this exercises the production configuration.

describe('concurrent writers on a file-backed SQLite database', () => {
  let dir: string;
  let sequelize: Sequelize;
  let schema: SequelizeSchema;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'conduit-concurrent-'));
    sequelize = createSequelize(`sqlite:${join(dir, 'test.sqlite')}`);
    const fields = { url: { type: 'String' } };
    schema = new SequelizeSchema(
      {} as ConduitGrpcSdk,
      sequelize,
      {
        collectionName: 'doc',
        fields: { url: { type: DataTypes.STRING } },
        modelOptions: {},
      },
      {
        name: 'Doc',
        collectionName: 'doc',
        fields,
        compiledFields: fields,
        modelOptions: {},
      } as unknown as ConduitDatabaseSchema,
      { sequelize } as unknown as SequelizeAdapter,
      {},
      {},
    );
    await schema.sync();
  });

  afterEach(async () => {
    await sequelize.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const seed = (n: number) =>
    Promise.all(Array.from({ length: n }, (_, i) => schema.create({ url: `old-${i}` })));

  it.each([10, 30])('applies %i concurrent conditional updateOne calls', async n => {
    const docs = await seed(n);
    const results = await Promise.allSettled(
      docs.map((d, i) =>
        schema.updateOne({ _id: d._id, url: `old-${i}` }, { url: `new-${i}` }),
      ),
    );
    expect(results.filter(r => r.status === 'rejected')).toEqual([]);
    const rows = await schema.model.findAll({ order: [['url', 'ASC']] });
    expect(rows.map((r: any) => r.url).sort()).toEqual(
      Array.from({ length: n }, (_, i) => `new-${i}`).sort(),
    );
  });

  it.each([10, 30])('applies %i concurrent findByIdAndUpdate calls', async n => {
    const docs = await seed(n);
    const results = await Promise.allSettled(
      docs.map((d, i) => schema.findByIdAndUpdate(d._id, { url: `new-${i}` })),
    );
    expect(results.filter(r => r.status === 'rejected')).toEqual([]);
    const rows = await schema.model.findAll();
    expect(rows.every((r: any) => r.url.startsWith('new-'))).toBe(true);
  });
});
