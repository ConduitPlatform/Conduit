import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { SequelizeAdapter } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';

// A file-backed SQLite database gives every transaction its own connection, so a
// transaction that is never committed keeps its write lock and blocks later writes.
// With ':memory:' all transactions share one connection and the leak is invisible.

function makeSchema(
  sequelize: Sequelize,
  name: string,
  fields: Record<string, any>,
  originalFields: Record<string, any>,
  relations: Record<string, any> = {},
) {
  return new SequelizeSchema(
    {} as ConduitGrpcSdk,
    sequelize,
    { collectionName: name.toLowerCase(), fields, modelOptions: {} },
    {
      name,
      collectionName: name.toLowerCase(),
      fields: originalFields,
      compiledFields: originalFields,
      modelOptions: {},
    } as unknown as ConduitDatabaseSchema,
    { sequelize } as unknown as SequelizeAdapter,
    relations,
    {},
  );
}

describe('SequelizeSchema updateOne on a file-backed database', () => {
  let dir: string;
  let sequelize: Sequelize;
  let schema: SequelizeSchema;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'conduit-updateone-'));
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: join(dir, 'test.sqlite'),
      logging: false,
    });
    schema = makeSchema(
      sequelize,
      'Doc',
      {
        url: { type: DataTypes.STRING },
        tags: { type: DataTypes.JSON, defaultValue: [] },
      },
      { url: { type: 'String' }, tags: { type: 'JSON' } },
    );
    await schema.sync();
  });

  afterEach(async () => {
    await sequelize.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const raw = (id: string) => schema.model.findByPk(id);

  /** Another writer changes the url between updateOne's read and its UPDATE. */
  function raceOtherWriter(id: string) {
    const original = schema.findOne.bind(schema);
    schema.findOne = (async (...args: Parameters<typeof original>) => {
      const found = await original(...args);
      await schema.model.update({ url: 'other' }, { where: { _id: id } });
      return found;
    }) as typeof schema.findOne;
  }

  it.each([
    ['without a predicate', false],
    ['with a predicate', true],
  ])('commits a $push-only update %s', async (_label, withPredicate) => {
    const doc = await schema.create({ url: 'a', tags: [] });
    const filter = withPredicate ? { _id: doc._id, url: 'a' } : { _id: doc._id };
    const updated = await schema.updateOne(filter, { $push: { tags: 'x' } });
    expect(updated.tags).toEqual(['x']);
    expect((await raw(doc._id)).tags).toEqual(['x']);
    // A leaked transaction would hold the write lock and fail this.
    await schema.updateOne(filter, { $push: { tags: 'y' } });
    expect((await raw(doc._id)).tags).toEqual(['x', 'y']);
  });

  it('releases the lock after an empty update with a predicate', async () => {
    const doc = await schema.create({ url: 'a', tags: [] });
    await schema.updateOne({ _id: doc._id, url: 'a' }, {});
    await schema.updateOne({ _id: doc._id, url: 'a' }, { url: 'b' });
    expect((await raw(doc._id)).url).toBe('b');
  });

  it('commits a mixed $push and set', async () => {
    const doc = await schema.create({ url: 'a', tags: [] });
    await schema.updateOne({ _id: doc._id, url: 'a' }, {
      $push: { tags: 'x' },
      url: 'b',
    } as any);
    const row = await raw(doc._id);
    expect(row.tags).toEqual(['x']);
    expect(row.url).toBe('b');
    await schema.updateOne({ _id: doc._id }, { url: 'c' });
    expect((await raw(doc._id)).url).toBe('c');
  });

  it('rolls back and releases the lock on a stale predicate', async () => {
    const doc = await schema.create({ url: 'a', tags: [] });
    raceOtherWriter(doc._id);
    await expect(
      schema.updateOne({ _id: doc._id, url: 'a' }, {
        $push: { tags: 'x' },
        url: 'b',
      } as any),
    ).rejects.toThrow('Document not found');
    expect(await raw(doc._id)).toMatchObject({ url: 'other', tags: [] });
    await schema.model.update({ url: 'again' }, { where: { _id: doc._id } });
  });

  it('pushes relation ids through the many-to-many association accessor', async () => {
    const tag = makeSchema(
      sequelize,
      'Tag',
      { label: { type: DataTypes.STRING } },
      { label: { type: 'String' } },
    );
    const withTags = makeSchema(
      sequelize,
      'Post',
      { title: { type: DataTypes.STRING } },
      { title: { type: 'String' } },
      { tagRefs: [tag] },
    );
    await tag.sync();
    await withTags.sync();
    const [t1, t2, t3] = await Promise.all(
      ['a', 'b', 'c'].map(label => tag.create({ label })),
    );
    const post = await withTags.create({ title: 'p' });

    await withTags.updateOne({ _id: post._id }, { $push: { tagRefs: t1._id } });
    await withTags.updateOne(
      { _id: post._id, title: 'p' },
      { $push: { tagRefs: { $each: [t2._id, t3._id] } } },
    );

    const row = await withTags.model.findByPk(post._id, { include: 'tagRefs' });
    expect(row.tagRefs.map((r: any) => r._id).sort()).toEqual(
      [t1._id, t2._id, t3._id].sort(),
    );
  });
});
