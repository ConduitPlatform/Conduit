import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { SequelizeAdapter } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';

function createSchema(sequelize: Sequelize) {
  const originalSchema = {
    name: 'Asset',
    collectionName: 'assets',
    fields: {
      url: { type: 'String' },
      sourceUrl: { type: 'String' },
      container: { type: 'String' },
      isPublic: { type: 'Boolean' },
    },
    modelOptions: {},
  } as unknown as ConduitDatabaseSchema;
  return new SequelizeSchema(
    {} as ConduitGrpcSdk,
    sequelize,
    {
      collectionName: 'assets',
      fields: {
        url: { type: DataTypes.STRING },
        sourceUrl: { type: DataTypes.STRING, allowNull: true },
        container: { type: DataTypes.STRING },
        isPublic: { type: DataTypes.BOOLEAN },
      },
      modelOptions: {},
    },
    originalSchema,
    { sequelize } as unknown as SequelizeAdapter,
    {},
    {},
  );
}

describe('SequelizeSchema findMany with null-valued operators', () => {
  let sequelize: Sequelize;
  let schema: SequelizeSchema;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    schema = createSchema(sequelize);
    await schema.sync();
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('$ne: null returns only rows with a non-null sourceUrl', async () => {
    await schema.create({ url: 'a', sourceUrl: 'src-a', container: 'c', isPublic: true });
    await schema.create({ url: 'b', container: 'c', isPublic: true });
    await schema.create({
      url: 'c',
      sourceUrl: 'src-c',
      container: 'c',
      isPublic: false,
    });

    const docs = await schema.findMany(
      JSON.stringify({ sourceUrl: { $ne: null } }) as any,
    );
    expect(docs.map((d: any) => d.url).sort()).toEqual(['a', 'c']);
  });

  it('$not: null does not throw', async () => {
    await schema.create({ url: 'a', sourceUrl: 'src-a', container: 'c', isPublic: true });
    await schema.create({ url: 'b', container: 'c', isPublic: true });

    await expect(
      schema.findMany(JSON.stringify({ sourceUrl: { $not: null } }) as any),
    ).resolves.toBeDefined();
  });

  it('combined $and filter pages in ascending _id order with only the selected keys', async () => {
    const rows = [
      { url: 'p1', sourceUrl: 'x', container: 'c', isPublic: true },
      { url: 'p2', sourceUrl: 'x', container: 'c', isPublic: true },
      { url: 'p3', sourceUrl: '', container: 'c', isPublic: true },
      { url: 'p4', container: 'c', isPublic: true },
      { url: 'p5', sourceUrl: 'x', container: 'other', isPublic: true },
      { url: 'p6', sourceUrl: 'x', container: 'c', isPublic: false },
      { url: 'p7', sourceUrl: 'x', container: 'c', isPublic: true },
      { url: 'p8', sourceUrl: 'x', container: 'c', isPublic: true },
    ];
    const created: { id: string; url: string }[] = [];
    for (const row of rows) {
      const doc = await schema.create(row);
      created.push({ id: doc._id, url: row.url });
    }
    // _id is a string key, so ascending order is by id value, not insertion order.
    const matchingUrls = ['p1', 'p2', 'p7', 'p8'];
    const matching = created
      .filter(c => matchingUrls.includes(c.url))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const expectedOrder = matching.map(c => c.url);
    const filter = {
      container: 'c',
      isPublic: true,
      $and: [
        { sourceUrl: { $exists: true } },
        { sourceUrl: { $ne: null } },
        { sourceUrl: { $ne: '' } },
      ],
    };
    const all = await schema.findMany(JSON.stringify(filter) as any, {
      skip: 0,
      limit: 10,
      sort: { _id: 1 },
      select: '_id url sourceUrl',
    });
    expect(all.map((d: any) => d.url)).toEqual(expectedOrder);
    for (const d of all) {
      expect(Object.keys(d).sort()).toEqual(['_id', 'sourceUrl', 'url']);
    }

    // Keyset page after the second matching id.
    const page = await schema.findMany(
      JSON.stringify({ ...filter, _id: { $gt: matching[1].id } }) as any,
      {
        skip: 0,
        limit: 2,
        sort: { _id: 1 },
        select: '_id url sourceUrl',
      },
    );
    expect(page.map((d: any) => d.url)).toEqual(expectedOrder.slice(2));
    for (const d of page) {
      expect(Object.keys(d).sort()).toEqual(['_id', 'sourceUrl', 'url']);
    }
  });
});
