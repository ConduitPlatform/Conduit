import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { Mongoose } from 'mongoose';
import { ConduitGrpcSdk, ConduitSchema } from '@conduitplatform/grpc-sdk';
import { MongooseAdapter } from '../../adapters/mongoose-adapter/index.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { isRetryableTransactionError } from '../errors.js';

// Needs a replica set: DB_CONN_URI=mongodb://.../?replicaSet=rs0
const replicaSetUri = process.env.DB_CONN_URI;
const integrationEnabled = Boolean(
  replicaSetUri?.startsWith('mongodb') && replicaSetUri.includes('replicaSet'),
);
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('MongoDB transactions', () => {
  let mongoose: Mongoose;
  let adapter: MongooseAdapter;
  let schema: MongooseSchema;

  beforeAll(async () => {
    mongoose = new Mongoose();
    await mongoose.connect(replicaSetUri!, {
      dbName: `conduit_transactions_${Date.now()}`,
    });
    adapter = Object.assign(Object.create(MongooseAdapter.prototype), {
      mongoose,
      models: {},
      views: {},
      queryDefaults: {
        readPreference: 'secondaryPreferred',
        writeConcern: 'majority',
        readConcern: 'majority',
      },
    });
    const definition = {
      name: 'Item',
      collectionName: 'items',
      fields: { name: { type: String }, stock: { type: Number } },
      modelOptions: {},
    } as unknown as ConduitSchema;
    schema = new MongooseSchema(
      {} as ConduitGrpcSdk,
      mongoose,
      definition,
      definition,
      adapter,
    );
    await schema.model.createCollection();
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase().catch(() => undefined);
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await schema.deleteMany({});
  });

  it('reports transaction support on a replica set', async () => {
    expect(await adapter.getTransactionSupport()).toEqual({ supported: true });
  });

  it('commits everything written in the transaction', async () => {
    const seeded = await schema.create({ name: 'seed', stock: 5 });
    const transaction = await adapter.beginTransaction();
    await schema.create({ name: 'widget', stock: 1 }, { transaction });
    await schema.createMany([{ name: 'a' }, { name: 'b' }], { transaction });
    await schema.updateOne({ _id: seeded._id }, { stock: 4 }, { transaction });
    await schema.deleteOne({ name: 'b' }, { transaction });

    // The transaction reads its own writes; nobody else sees them yet.
    expect(await schema.countDocuments({}, { transaction })).toBe(3);
    expect(await schema.findOne({ name: 'seed' }, { transaction })).toMatchObject({
      stock: 4,
    });
    expect(await schema.findMany({}, { transaction })).toHaveLength(3);
    expect(await schema.countDocuments({}, { readPreference: 'primary' })).toBe(1);

    expect(await adapter.commitTransaction(transaction)).toEqual([]);
    const names = (await schema.findMany({}, { readPreference: 'primary' })).map(
      (item: { name: string }) => item.name,
    );
    expect(names.sort()).toEqual(['a', 'seed', 'widget']);
  });

  it('rolls everything back', async () => {
    const seeded = await schema.create({ name: 'seed', stock: 5 });
    const transaction = await adapter.beginTransaction();
    await schema.create({ name: 'widget', stock: 1 }, { transaction });
    await schema.updateMany({}, { stock: 0 }, { transaction });
    await schema.deleteMany({ _id: seeded._id }, { transaction });
    await adapter.rollbackTransaction(transaction);

    expect(await schema.findMany({}, { readPreference: 'primary' })).toMatchObject([
      { name: 'seed', stock: 5 },
    ]);
  });

  it('runs after-commit hooks only on commit', async () => {
    const calls: string[] = [];
    const rolledBack = await adapter.beginTransaction();
    rolledBack.afterCommit(() => calls.push('rolled back'));
    await adapter.rollbackTransaction(rolledBack);

    const committed = await adapter.beginTransaction();
    committed.afterCommit(() => calls.push('committed'));
    await adapter.commitTransaction(committed);
    expect(calls).toEqual(['committed']);
  });

  it('marks a write conflict as retryable', async () => {
    const seeded = await schema.create({ name: 'seed', stock: 5 });
    const first = await adapter.beginTransaction();
    const second = await adapter.beginTransaction();
    await schema.updateOne({ _id: seeded._id }, { stock: 1 }, { transaction: first });
    const conflict = await schema
      .updateOne({ _id: seeded._id }, { stock: 2 }, { transaction: second })
      .catch(e => e);
    expect(isRetryableTransactionError(conflict)).toBe(true);
    await adapter.rollbackTransaction(second);
    await adapter.commitTransaction(first);
    expect(await schema.findOne({ _id: seeded._id })).toMatchObject({ stock: 1 });
  });
});
