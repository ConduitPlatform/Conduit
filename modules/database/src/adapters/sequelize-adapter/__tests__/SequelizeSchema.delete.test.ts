import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { SequelizeAdapter } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';

function createSchema(sequelize: Sequelize) {
  const originalSchema = {
    name: 'Token',
    collectionName: 'tokens',
    fields: { token: { type: 'String' } },
    modelOptions: {},
  } as unknown as ConduitDatabaseSchema;
  return new SequelizeSchema(
    {} as ConduitGrpcSdk,
    sequelize,
    {
      collectionName: 'tokens',
      fields: { token: { type: DataTypes.STRING } },
      modelOptions: {},
    },
    originalSchema,
    { sequelize } as unknown as SequelizeAdapter,
    {},
    {},
  );
}

describe('SequelizeSchema deletes', () => {
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

  it('deleteOne reports the rows it removed', async () => {
    await schema.create({ token: 'a' });
    await expect(schema.deleteOne({ token: 'a' })).resolves.toEqual({ deletedCount: 1 });
    await expect(schema.deleteOne({ token: 'a' })).resolves.toEqual({ deletedCount: 0 });
  });

  it('lets only one of two concurrent deleteOne calls remove the row', async () => {
    await schema.create({ token: 'a' });
    const results = await Promise.all([
      schema.deleteOne({ token: 'a' }),
      schema.deleteOne({ token: 'a' }),
    ]);
    expect(results.map(r => r.deletedCount).sort()).toEqual([0, 1]);
  });

  it('deleteMany counts only rows it removed', async () => {
    await schema.create({ token: 'a' });
    await schema.create({ token: 'a' });
    await schema.create({ token: 'b' });
    const results = await Promise.all([
      schema.deleteMany({ token: 'a' }),
      schema.deleteMany({ token: 'a' }),
    ]);
    expect(results[0].deletedCount + results[1].deletedCount).toBe(2);
    await expect(schema.deleteMany({ token: 'b' })).resolves.toEqual({ deletedCount: 1 });
    await expect(schema.countDocuments({})).resolves.toBe(0);
  });
});
