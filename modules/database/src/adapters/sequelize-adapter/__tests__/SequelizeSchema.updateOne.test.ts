import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { SequelizeAdapter } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';

function createSchema(sequelize: Sequelize) {
  const originalSchema = {
    name: 'Doc',
    collectionName: 'docs',
    fields: { url: { type: 'String' } },
    modelOptions: {},
  } as unknown as ConduitDatabaseSchema;
  return new SequelizeSchema(
    {} as ConduitGrpcSdk,
    sequelize,
    {
      collectionName: 'docs',
      fields: { url: { type: DataTypes.STRING } },
      modelOptions: {},
    },
    originalSchema,
    { sequelize } as unknown as SequelizeAdapter,
    {},
    {},
  );
}

describe('SequelizeSchema updateOne predicate', () => {
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

  it('updates when the predicate matches', async () => {
    const doc = await schema.create({ url: 'a' });
    const updated = await schema.updateOne({ _id: doc._id, url: 'a' }, { url: 'b' });
    expect(updated.url).toBe('b');
  });

  it('does not update and throws when the predicate is stale', async () => {
    const doc = await schema.create({ url: 'a' });
    // Another writer lands between the find and the UPDATE.
    const original = schema.findOne.bind(schema);
    schema.findOne = (async (...args: Parameters<typeof original>) => {
      const found = await original(...args);
      await schema.model.update({ url: 'other' }, { where: { _id: doc._id } });
      return found;
    }) as typeof schema.findOne;
    await expect(
      schema.updateOne({ _id: doc._id, url: 'a' }, { url: 'b' }),
    ).rejects.toThrow('Document not found');
    schema.findOne = original;
    expect((await schema.findOne({ _id: doc._id }))!.url).toBe('other');
  });

  it('throws when nothing matches the filter', async () => {
    const doc = await schema.create({ url: 'a' });
    await expect(
      schema.updateOne({ _id: doc._id, url: 'x' }, { url: 'b' }),
    ).rejects.toThrow('Document not found');
  });

  it('succeeds when the update sets identical values', async () => {
    const doc = await schema.create({ url: 'a' });
    const updated = await schema.updateOne({ _id: doc._id, url: 'a' }, { url: 'a' });
    expect(updated.url).toBe('a');
  });
});
