import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Metadata, status } from '@grpc/grpc-js';
import { DataTypes, Sequelize } from 'sequelize';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import DatabaseModule from '../../Database.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';
import { createSequelize } from '../../adapters/sequelize-adapter/utils/sqlite.js';
import { ConduitDatabaseSchema } from '../../interfaces/index.js';
import { TransactionRequest } from '../../protoTypes/database.js';

// The Database module's own query handlers, driven through its transaction stream.

class FakeCall extends EventEmitter {
  metadata = new Metadata();
  written: { result: string }[] = [];
  failure?: { code: status; message: string };
  private settle?: () => void;

  constructor(moduleName: string) {
    super();
    this.metadata.set('module-name', moduleName);
    this.on('error', error => {
      this.failure = error;
      this.settle?.();
    });
  }

  write(message: { result: string }) {
    this.written.push(message);
    this.settle?.();
  }

  end() {}

  /** Sends one message and waits for its response, or for the stream to fail. */
  async send(message: Partial<TransactionRequest>): Promise<any> {
    const settled = new Promise<void>(resolve => (this.settle = resolve));
    this.emit('data', message);
    await settled;
    if (this.failure) throw this.failure;
    const { result } = this.written[this.written.length - 1];
    return result === '' ? undefined : JSON.parse(result);
  }
}

describe('Database module transactions', () => {
  let dir: string;
  let sequelize: Sequelize;
  let schema: SequelizeSchema;
  let database: DatabaseModule;
  const publish = jest.fn();

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'conduit-db-transaction-'));
    sequelize = createSequelize(`sqlite:${join(dir, 'test.sqlite')}`);
    const fields = { name: { type: 'String' }, stock: { type: 'Number' } };
    const adapter = Object.assign(Object.create(SequelizeAdapter.prototype), {
      sequelize,
      getSchemaModel: () => ({ model: schema }),
    });
    schema = new SequelizeSchema(
      {} as ConduitGrpcSdk,
      sequelize,
      {
        collectionName: 'item',
        fields: { name: { type: DataTypes.STRING }, stock: { type: DataTypes.INTEGER } },
        modelOptions: {},
      },
      {
        name: 'Item',
        collectionName: 'item',
        ownerModule: 'shop',
        fields,
        compiledFields: fields,
        modelOptions: { conduit: { permissions: {} } },
      } as unknown as ConduitDatabaseSchema,
      adapter,
      {},
      {},
    );
    await schema.sync();
    database = Object.assign(Object.create(DatabaseModule.prototype), {
      _activeAdapter: adapter,
      grpcSdk: { bus: { publish } },
    });
    Object.defineProperty(database, 'name', { value: 'database' });
  });

  afterAll(async () => {
    await sequelize.close();
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await schema.deleteMany({});
    publish.mockClear();
  });

  function open(moduleName = 'shop') {
    const call = new FakeCall(moduleName);
    database.transaction(call as never);
    return call;
  }

  const item = (data: object) => ({ schemaName: 'Item', query: JSON.stringify(data) });

  it('commits the writes and only then publishes their mutation events', async () => {
    const seeded = await schema.create({ name: 'seed', stock: 5 });
    const call = open();
    await call.send({ begin: {} });
    const created = await call.send({ create: item({ name: 'widget', stock: 1 }) });
    await call.send({
      updateMany: {
        schemaName: 'Item',
        filterQuery: JSON.stringify({ name: 'seed' }),
        query: JSON.stringify({ stock: 4 }),
        populate: [],
      },
    });
    expect(await call.send({ countDocuments: item({}) })).toBe(2);
    expect(publish).not.toHaveBeenCalled();
    expect(await schema.model.count()).toBe(1);

    await call.send({ commit: {} });
    expect(publish.mock.calls).toEqual([
      ['database:create:Item', JSON.stringify(created)],
      ['database:updateMany:Item', JSON.stringify([{ _id: seeded._id }])],
    ]);
    expect(await schema.findMany({}, { sort: { stock: 1 } })).toMatchObject([
      { name: 'widget', stock: 1 },
      { name: 'seed', stock: 4 },
    ]);
  });

  it('publishes nothing for a transaction that is rolled back', async () => {
    const call = open();
    await call.send({ begin: {} });
    await call.send({ create: item({ name: 'widget', stock: 1 }) });
    await call.send({ deleteMany: item({ name: 'widget' }) });
    await call.send({ rollback: {} });
    expect(publish).not.toHaveBeenCalled();
    expect(await schema.countDocuments({})).toBe(0);
  });

  it('enforces module permissions and rolls back on a refused write', async () => {
    const call = open('intruder');
    await call.send({ begin: {} });
    await expect(call.send({ create: item({ name: 'widget' }) })).rejects.toMatchObject({
      code: status.PERMISSION_DENIED,
    });
    // The write lock is free again.
    await schema.create({ name: 'next', stock: 1 });
    expect(await schema.countDocuments({})).toBe(1);
  });

  it('rolls back earlier writes when a later operation fails', async () => {
    const call = open();
    await call.send({ begin: {} });
    await call.send({ create: item({ name: 'widget', stock: 1 }) });
    await expect(
      call.send({
        updateOne: {
          schemaName: 'Item',
          filterQuery: JSON.stringify({ name: 'missing' }),
          query: JSON.stringify({ stock: 2 }),
          populate: [],
        },
      }),
    ).rejects.toMatchObject({
      code: status.NOT_FOUND,
      message: expect.stringContaining('DOCUMENT_NOT_FOUND'),
    });
    expect(publish).not.toHaveBeenCalled();
    expect(await schema.countDocuments({})).toBe(0);
  });
});
