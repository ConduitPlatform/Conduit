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

// The storage module's CDN reconciliation (modules/storage/src/migrations/
// cdnConfigMigration.ts) reads files with publicFilesWithProviderSourceQuery and writes
// each url with updateOne({ _id, url: observed }, { url: next }). Storage cannot import
// this module, so its test "publicFilesWithProviderSourceQuery" in
// cdnConfigMigration.test.ts asserts the exact filter used below, and this file runs
// the read and the conditional write against real SQL. Keep the two in sync.

const storageQuery = (container: string, afterId?: string) => ({
  container,
  isPublic: true,
  $and: [
    { sourceUrl: { $exists: true } },
    { sourceUrl: { $ne: null } },
    { sourceUrl: { $ne: '' } },
  ],
  ...(afterId ? { _id: { $gt: afterId } } : {}),
});

describe('storage CDN reconciliation query and write on file-backed SQLite', () => {
  let dir: string;
  let sequelize: Sequelize;
  let schema: SequelizeSchema;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'conduit-cdn-'));
    sequelize = createSequelize(`sqlite:${join(dir, 'test.sqlite')}`);
    const fields = {
      url: { type: 'String' },
      sourceUrl: { type: 'String' },
      container: { type: 'String' },
      isPublic: { type: 'Boolean' },
    };
    schema = new SequelizeSchema(
      {} as ConduitGrpcSdk,
      sequelize,
      {
        collectionName: 'files',
        fields: {
          url: { type: DataTypes.STRING, allowNull: true },
          sourceUrl: { type: DataTypes.STRING, allowNull: true },
          container: { type: DataTypes.STRING },
          isPublic: { type: DataTypes.BOOLEAN },
        },
        modelOptions: {},
      },
      {
        name: 'File',
        collectionName: 'files',
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

  it('finds the files to reconcile and resumes after a checkpoint id', async () => {
    const base = { container: 'media', isPublic: true };
    const rows = await Promise.all(
      [
        { ...base, url: 'u1', sourceUrl: 'https://s/1' },
        { ...base, url: 'u2', sourceUrl: 'https://s/2' },
        { ...base, url: 'u3', sourceUrl: '' },
        { ...base, url: 'u4' },
        { ...base, url: 'u5', sourceUrl: 'https://s/5', container: 'other' },
        { ...base, url: 'u6', sourceUrl: 'https://s/6', isPublic: false },
      ].map(row => schema.create(row)),
    );
    const matching = rows
      .filter(r => ['u1', 'u2'].includes(r.url))
      .sort((a, b) => (a._id < b._id ? -1 : 1));

    const all = await schema.findMany(JSON.stringify(storageQuery('media')) as any, {
      skip: 0,
      limit: 10,
      sort: { _id: 1 },
      select: '_id url sourceUrl',
    });
    expect(all.map((d: any) => d._id)).toEqual(matching.map(m => m._id));

    const rest = await schema.findMany(
      JSON.stringify(storageQuery('media', matching[0]._id)) as any,
      { skip: 0, limit: 10, sort: { _id: 1 }, select: '_id url sourceUrl' },
    );
    expect(rest.map((d: any) => d._id)).toEqual([matching[1]._id]);
  });

  it('writes the url when the observed url is null', async () => {
    const doc = await schema.create({ container: 'media', isPublic: true });
    const updated = await schema.updateOne({ _id: doc._id, url: null } as any, {
      url: 'https://cdn/a',
    });
    expect(updated.url).toBe('https://cdn/a');
    expect((await schema.model.findByPk(doc._id))!.url).toBe('https://cdn/a');
  });

  it('writes the url when the observed url matches', async () => {
    const doc = await schema.create({ container: 'media', url: 'old' });
    await schema.updateOne({ _id: doc._id, url: 'old' }, { url: 'https://cdn/a' });
    expect((await schema.model.findByPk(doc._id))!.url).toBe('https://cdn/a');
  });

  it('misses without writing when the stored url differs from the observed url', async () => {
    const stale = await schema.create({ container: 'media', url: 'current' });
    await expect(
      schema.updateOne({ _id: stale._id, url: 'old' }, { url: 'https://cdn/a' }),
    ).rejects.toThrow('Document not found');
    expect((await schema.model.findByPk(stale._id))!.url).toBe('current');

    const unset = await schema.create({ container: 'media' });
    await expect(
      schema.updateOne({ _id: unset._id, url: 'old' }, { url: 'https://cdn/a' }),
    ).rejects.toThrow('Document not found');
    expect((await schema.model.findByPk(unset._id))!.url).toBeNull();
  });
});
