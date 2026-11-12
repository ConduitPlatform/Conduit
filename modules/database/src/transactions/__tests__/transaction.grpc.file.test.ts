import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  credentials,
  loadPackageDefinition,
  Server,
  ServerCredentials,
  status,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { DataTypes, Sequelize } from 'sequelize';
import {
  ConduitGrpcSdk,
  DatabaseTransaction as SdkTransaction,
} from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';
import { createSequelize } from '../../adapters/sequelize-adapter/utils/sqlite.js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';
import { DatabaseTransaction } from '../DatabaseTransaction.js';
import { TransactionCall, TransactionStream } from '../TransactionStream.js';

// The whole path a module takes: the SDK's transaction client, a real gRPC
// stream, the stream handler and a file-backed SQLite database.

const protoPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'database.proto',
);

// SQLite always runs; PostgreSQL joins in when DB_CONN_URI points at one.
const postgresUri = process.env.DB_CONN_URI?.startsWith('postgres')
  ? process.env.DB_CONN_URI
  : undefined;
const databases: [string, (dir: string) => string][] = [
  ['SQLite', dir => `sqlite:${join(dir, 'test.sqlite')}`],
  ...(postgresUri ? [['PostgreSQL', () => postgresUri] as [string, () => string]] : []),
];

describe.each(databases)('transactions over gRPC (%s)', (_name, uriFor) => {
  let dir: string;
  let sequelize: Sequelize;
  let schema: SequelizeSchema;
  let server: Server;
  let client: any;
  const createRelation = jest.fn(async (_relation: unknown) => {});
  const published: string[] = [];

  beforeAll(async () => {
    // Unscoped calls on an authorization-enabled schema log a warning each.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    dir = mkdtempSync(join(tmpdir(), 'conduit-transaction-'));
    sequelize = createSequelize(uriFor(dir));
    await sequelize.getQueryInterface().dropTable('item');
    const fields = { name: { type: 'String' }, stock: { type: 'Number' } };
    const adapter = { sequelize } as unknown as SequelizeAdapter;
    schema = new SequelizeSchema(
      {
        isAvailable: () => true,
        authorization: { can: async () => ({ allow: true }), createRelation },
      } as unknown as ConduitGrpcSdk,
      sequelize,
      {
        collectionName: 'item',
        fields: { name: { type: DataTypes.STRING }, stock: { type: DataTypes.INTEGER } },
        modelOptions: {},
      },
      {
        name: 'Item',
        collectionName: 'item',
        fields,
        compiledFields: fields,
        modelOptions: { conduit: { authorization: { enabled: true } } },
      } as unknown as ConduitDatabaseSchema,
      adapter,
      {},
      {},
    );
    await schema.sync();

    const lifecycle = SequelizeAdapter.prototype;
    const execute = async (
      operation: string,
      request: any,
      transaction: DatabaseTransaction,
    ) => {
      try {
        const options = { userId: request.userId, transaction };
        let result;
        switch (operation) {
          case 'create':
            result = await schema.create(request.query, options);
            transaction.afterCommit(() => published.push(result._id));
            break;
          case 'findOne':
            result = await schema.findOne(request.query, { transaction });
            break;
          case 'findMany':
            result = await schema.findMany(request.query, { transaction });
            break;
          case 'updateOne':
            result = await schema.updateOne(request.filterQuery, request.query, options);
            break;
          case 'deleteMany':
            result = await schema.deleteMany(request.query, options);
            break;
          case 'countDocuments':
            result = await schema.countDocuments(request.query, { transaction });
            break;
          default:
            throw new Error(`Unexpected operation ${operation}`);
        }
        return JSON.stringify(result);
      } catch (e) {
        transaction.recordFailure(e);
        throw { code: status.INTERNAL, message: (e as Error).message };
      }
    };

    const definition = loadPackageDefinition(
      // the options module-tools serves the proto with
      loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      }),
    ) as any;
    server = new Server();
    server.addService(definition.database.DatabaseProvider.service, {
      transaction: (call: unknown) =>
        new TransactionStream(call as TransactionCall, {
          adapter: {
            getTransactionSupport: () => lifecycle.getTransactionSupport.call(adapter),
            beginTransaction: () => lifecycle.beginTransaction.call(adapter),
            commitTransaction: t => lifecycle.commitTransaction.call(adapter, t),
            rollbackTransaction: t => lifecycle.rollbackTransaction.call(adapter, t),
          },
          execute,
          maxDurationMs: 60_000,
        }).start(),
    });
    const port = await new Promise<number>((resolve, reject) =>
      server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (err, p) =>
        err ? reject(err) : resolve(p),
      ),
    );
    client = new definition.database.DatabaseProvider(
      `127.0.0.1:${port}`,
      credentials.createInsecure(),
    );
  });

  afterAll(async () => {
    client?.close();
    server?.forceShutdown();
    await sequelize?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await schema.deleteMany({});
    createRelation.mockClear();
    published.length = 0;
  });

  /** What `DatabaseProvider.withTransaction` does, minus the SDK's own gRPC client. */
  async function withTransaction<R>(
    work: (tx: SdkTransaction) => Promise<R>,
  ): Promise<R> {
    const tx = new SdkTransaction(requests => {
      const call = client.transaction();
      (async () => {
        for await (const request of requests) call.write(request);
        call.end();
      })();
      return call;
    });
    try {
      await tx.begin();
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback().catch(() => {});
      throw e;
    }
  }

  it('commits everything written in the transaction', async () => {
    const seeded = await schema.create({ name: 'seed', stock: 5 });
    const created = await withTransaction(async tx => {
      const item = await tx.create<any>('Item', { name: 'widget', stock: 1 });
      await tx.updateOne('Item', { _id: seeded._id }, { stock: 4 });
      // The transaction reads its own writes.
      expect(await tx.countDocuments('Item', {})).toBe(2);
      expect(await tx.findOne<any>('Item', { _id: seeded._id })).toMatchObject({
        stock: 4,
      });
      // Nobody else sees them yet.
      expect(await schema.model.count()).toBe(1);
      return item;
    });

    const items = await schema.findMany({}, { sort: { stock: 1 } });
    expect(items.map((i: any) => [i.name, i.stock])).toEqual([
      ['widget', 1],
      ['seed', 4],
    ]);
    expect(created.name).toBe('widget');
  });

  it('rolls everything back when the work throws', async () => {
    const seeded = await schema.create({ name: 'seed', stock: 5 });
    await expect(
      withTransaction(async tx => {
        await tx.create('Item', { name: 'widget', stock: 1 });
        await tx.updateOne('Item', { _id: seeded._id }, { stock: 0 });
        await tx.deleteMany('Item', { name: 'seed' });
        throw new Error('changed my mind');
      }),
    ).rejects.toThrow('changed my mind');

    expect(await schema.findMany({})).toMatchObject([{ name: 'seed', stock: 5 }]);
  });

  it('rolls back and fails the transaction when an operation fails', async () => {
    let later: Promise<unknown> | undefined;
    await expect(
      withTransaction(async tx => {
        await tx.create('Item', { name: 'widget', stock: 1 });
        await tx.updateOne('Item', { name: 'missing' }, { stock: 2 }).catch(() => {});
        // The transaction is gone, even though the failure was swallowed.
        later = tx.create('Item', { name: 'late', stock: 3 });
        await later.catch(() => {});
      }),
    ).rejects.toMatchObject({
      code: status.INTERNAL,
      details: expect.stringContaining('Document not found'),
    });
    await expect(later).rejects.toMatchObject({
      details: expect.stringContaining('Document not found'),
    });
    expect(await schema.countDocuments({})).toBe(0);
  });

  it('emits events and ownership relations only once the transaction commits', async () => {
    await expect(
      withTransaction(async tx => {
        await tx.create('Item', { name: 'widget', stock: 1 }, { userId: 'u1' });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(createRelation).not.toHaveBeenCalled();
    expect(published).toEqual([]);

    const item = await withTransaction(async tx => {
      const created = await tx.create<any>(
        'Item',
        { name: 'widget', stock: 1 },
        { userId: 'u1' },
      );
      expect(createRelation).not.toHaveBeenCalled();
      expect(published).toEqual([]);
      return created;
    });
    expect(createRelation).toHaveBeenCalledWith({
      subject: 'User:u1',
      relation: 'owner',
      resource: `Item:${item._id}`,
    });
    expect(published).toEqual([item._id]);
  });

  it('rolls back when the client disconnects mid-transaction', async () => {
    const call = client.transaction();
    const responses = call[Symbol.asyncIterator]();
    call.write({ begin: {} });
    await responses.next();
    call.write({
      create: { schemaName: 'Item', query: JSON.stringify({ name: 'orphan' }) },
    });
    await responses.next();
    call.cancel();
    await responses.next().catch(() => {});

    // The write lock is released, so a new writer gets through, and finds nothing.
    await schema.create({ name: 'next', stock: 1 });
    expect((await schema.findMany({})).map((i: any) => i.name)).toEqual(['next']);
  });
});
