import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DatabaseProvider } from './index.js';
import { DatabaseTransaction, TransactionUnavailableError } from './transaction.js';
import { setLogger } from '../../utilities/GrpcSdkContext.js';

type Message = Record<string, any>;
type Reply = (operation: string, message: Message) => string | Error;

/** A Database stand-in: answers each message in turn, or fails the stream. */
function setup(reply: Reply = operation => JSON.stringify({ operation })) {
  const streams: string[][] = [];
  const db = new DatabaseProvider('test', 'localhost:0');
  Object.defineProperty(db, 'client', {
    configurable: true,
    get: () => ({
      transaction: async function* (requests: AsyncIterable<Message>) {
        const seen: string[] = [];
        streams.push(seen);
        for await (const message of requests) {
          const operation = Object.keys(message)[0];
          seen.push(operation);
          const answer = reply(operation, message[operation]);
          if (answer instanceof Error) throw answer;
          yield { result: answer };
          if (operation === 'commit' || operation === 'rollback') return;
        }
      },
    }),
  });
  return { db, streams };
}

const aborted = () => Object.assign(new Error('conflict'), { code: 10 });

describe('DatabaseProvider.withTransaction', () => {
  it('begins, runs the work and commits', async () => {
    const { db, streams } = setup((operation, message) =>
      JSON.stringify({ operation, schema: message.schemaName }),
    );
    const result = await db.withTransaction(async tx => {
      const created = await tx.create('Order', { total: 5 });
      await tx.updateOne('Stock', { item: 'a' }, { $inc: { quantity: -1 } });
      return created;
    });
    assert.deepEqual(result, { operation: 'create', schema: 'Order' });
    assert.deepEqual(streams, [['begin', 'create', 'updateOne', 'commit']]);
  });

  it('sends the same requests as the one-off calls', async () => {
    const sent: Message[] = [];
    const { db } = setup((operation, message) => {
      sent.push({ [operation]: message });
      return '{}';
    });
    await db.withTransaction(
      async tx => {
        await tx.findMany(
          'User',
          { active: true },
          { sort: '-createdAt', populate: 'team' },
        );
        await tx.findByIdAndUpdate('User', 'u1', { name: 'x' }, { userId: 'u2' });
      },
      { timeoutMs: 5000 },
    );
    assert.deepEqual(sent[0], { begin: { timeoutMs: 5000 } });
    assert.deepEqual(sent[1], {
      findMany: {
        schemaName: 'User',
        query: '{"active":true}',
        select: undefined,
        sort: { createdAt: -1 },
        populate: ['team'],
      },
    });
    assert.deepEqual(sent[2], {
      findByIdAndUpdate: {
        schemaName: 'User',
        id: 'u1',
        query: '{"name":"x"}',
        userId: 'u2',
        scope: undefined,
        populate: [],
        suppressEvent: undefined,
      },
    });
  });

  it('runs concurrent calls one at a time', async () => {
    const { db, streams } = setup();
    await db.withTransaction(tx =>
      Promise.all([
        tx.findOne('A', {}),
        tx.countDocuments('B', {}),
        tx.deleteOne('C', {}),
      ]),
    );
    assert.deepEqual(streams, [
      ['begin', 'findOne', 'countDocuments', 'deleteOne', 'commit'],
    ]);
  });

  it('rolls back and rethrows when the work throws', async () => {
    const { db, streams } = setup();
    await assert.rejects(
      db.withTransaction(async tx => {
        await tx.create('Order', {});
        throw new Error('changed my mind');
      }),
      /changed my mind/,
    );
    assert.deepEqual(streams, [['begin', 'create', 'rollback']]);
  });

  it('fails the transaction when a call fails, even if the work swallows it', async () => {
    const failure = Object.assign(new Error('not found'), { code: 13 });
    const { db, streams } = setup(operation =>
      operation === 'updateOne' ? failure : '{}',
    );
    let late: Promise<unknown> | undefined;
    await assert.rejects(
      db.withTransaction(async tx => {
        await tx.updateOne('Order', {}, {}).catch(() => {});
        late = tx.create('Order', {});
        await late.catch(() => {});
      }),
      failure,
    );
    await assert.rejects(late!, failure);
    assert.deepEqual(streams, [['begin', 'updateOne']]);
  });

  it('does not run the work again unless asked to', async () => {
    const { db, streams } = setup(operation =>
      operation === 'create' ? aborted() : '{}',
    );
    await assert.rejects(
      db.withTransaction(tx => tx.create('Order', {})),
      { code: 10 },
    );
    assert.equal(streams.length, 1);
  });

  it('runs the work again when the database asks for a retry', async () => {
    let conflicts = 2;
    const { db, streams } = setup(operation =>
      operation === 'create' && conflicts-- > 0 ? aborted() : '"ok"',
    );
    const result = await db.withTransaction(tx => tx.create('Order', {}), { retries: 2 });
    assert.equal(result, 'ok');
    assert.deepEqual(streams, [
      ['begin', 'create'],
      ['begin', 'create'],
      ['begin', 'create', 'commit'],
    ]);
  });

  it('does not retry other failures', async () => {
    const { db, streams } = setup(operation =>
      operation === 'create' ? Object.assign(new Error('denied'), { code: 7 }) : '{}',
    );
    await assert.rejects(
      db.withTransaction(tx => tx.create('Order', {}), { retries: 3 }),
      { code: 7 },
    );
    assert.equal(streams.length, 1);
  });

  it('runs commit hooks after the commit, and not after a rollback', async () => {
    const { db, streams } = setup();
    const events: string[] = [];
    await db.withTransaction(async tx => {
      tx.onCommit(() => events.push(`hook after ${streams[0].join(',')}`));
      await tx.create('Order', {});
      events.push('work done');
    });
    assert.deepEqual(events, ['work done', 'hook after begin,create,commit']);

    await assert.rejects(
      db.withTransaction(async tx => {
        tx.onCommit(() => events.push('must not run'));
        throw new Error('abort');
      }),
    );
    assert.equal(events.length, 2);
  });

  it('refuses calls once the transaction has ended', async () => {
    const { db } = setup();
    let leaked: DatabaseTransaction | undefined;
    await db.withTransaction(async tx => {
      leaked = tx;
    });
    await assert.rejects(leaked!.create('Order', {}), /not open/);
  });
});

describe('DatabaseProvider.withOptionalTransaction', () => {
  const unsupported = () =>
    Object.assign(new Error('refused'), {
      code: 9,
      details: 'Transactions require a replica set or sharded MongoDB deployment',
    });

  /** A provider whose one-off calls are recorded, on top of the transaction stand-in. */
  function setupWithCalls(reply?: Reply) {
    const { db, streams } = setup(reply);
    const direct: string[] = [];
    const client = (db as any).client;
    Object.defineProperty(db, 'client', {
      configurable: true,
      get: () => ({
        ...client,
        create: async ({ schemaName }: Message) => {
          direct.push(`create ${schemaName}`);
          return { result: '"direct"' };
        },
      }),
    });
    const warnings: string[] = [];
    setLogger({ warn: (message: string) => warnings.push(message) } as never);
    return { db, streams, direct, warnings };
  }

  it('uses a transaction when the database supports one', async () => {
    const { db, streams, direct, warnings } = setupWithCalls(() => '"in transaction"');
    const result = await db.withOptionalTransaction(tx => tx.create('Order', {}));
    assert.equal(result, 'in transaction');
    assert.deepEqual(streams, [['begin', 'create', 'commit']]);
    assert.deepEqual(direct, []);
    assert.deepEqual(warnings, []);
  });

  it('runs the work on plain calls, with a warning, when it does not', async () => {
    const { db, streams, direct, warnings } = setupWithCalls(operation =>
      operation === 'begin' ? unsupported() : '{}',
    );
    const result = await db.withOptionalTransaction(tx => tx.create('Order', {}));
    assert.equal(result, 'direct');
    assert.deepEqual(streams, [['begin']]);
    assert.deepEqual(direct, ['create Order']);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /replica set.*module "test".*without atomicity/);
  });

  it('warns once and does not ask Database again straight away', async () => {
    const { db, streams, direct, warnings } = setupWithCalls(operation =>
      operation === 'begin' ? unsupported() : '{}',
    );
    for (let i = 0; i < 3; i++) {
      await db.withOptionalTransaction(tx => tx.create('Order', {}));
    }
    assert.equal(streams.length, 1);
    assert.equal(direct.length, 3);
    assert.equal(warnings.length, 1);
  });

  it('falls back on a Database that predates transactions', async () => {
    const { db, direct } = setupWithCalls(() =>
      Object.assign(new Error('unimplemented'), { code: 12 }),
    );
    await db.withOptionalTransaction(tx => tx.create('Order', {}));
    assert.deepEqual(direct, ['create Order']);
  });

  it('does not fall back once the transaction has begun', async () => {
    const failure = Object.assign(new Error('precondition'), { code: 9 });
    const { db, direct } = setupWithCalls(operation =>
      operation === 'create' ? failure : '{}',
    );
    await assert.rejects(
      db.withOptionalTransaction(tx => tx.create('Order', {})),
      failure,
    );
    assert.deepEqual(direct, []);
  });

  it('withTransaction itself refuses instead of falling back', async () => {
    const { db, direct } = setupWithCalls(operation =>
      operation === 'begin' ? unsupported() : '{}',
    );
    await assert.rejects(
      db.withTransaction(tx => tx.create('Order', {})),
      TransactionUnavailableError,
    );
    assert.deepEqual(direct, []);
  });
});
