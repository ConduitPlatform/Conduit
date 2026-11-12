import { describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { status } from '@grpc/grpc-js';
import { DatabaseTransaction } from '../DatabaseTransaction.js';
import {
  TransactionCall,
  TransactionStream,
  TransactionStreamOptions,
} from '../TransactionStream.js';
import { TransactionRequest } from '../../protoTypes/database.js';

class FakeCall extends EventEmitter {
  written: { result: string }[] = [];
  ended = false;
  failure?: { code: status; message: string };

  constructor() {
    super();
    // gRPC turns an error on the stream into its final status.
    this.on('error', error => (this.failure = error));
  }

  write(message: { result: string }) {
    this.written.push(message);
  }

  end() {
    this.ended = true;
  }
}

function setup(overrides: Partial<TransactionStreamOptions> = {}) {
  const call = new FakeCall();
  const transaction = new DatabaseTransaction({});
  const adapter = {
    getTransactionSupport: jest.fn(async () => ({ supported: true })),
    beginTransaction: jest.fn(async () => transaction),
    commitTransaction: jest.fn(async (t: DatabaseTransaction) => t.runAfterCommit()),
    rollbackTransaction: jest.fn(async (_t: DatabaseTransaction) => {}),
  };
  const execute = jest.fn(
    async (operation: string, _request: unknown) => `"${operation}"`,
  );
  const stream = new TransactionStream(call as unknown as TransactionCall, {
    adapter,
    execute,
    maxDurationMs: 60_000,
    ...overrides,
  });
  stream.start();
  const send = async (message: TransactionRequest) => {
    call.emit('data', message);
    await stream.idle();
  };
  return { call, transaction, adapter, execute, stream, send };
}

const query = { schemaName: 'Doc', query: '{}' };

describe('TransactionStream', () => {
  it('runs operations in the transaction and commits', async () => {
    const { call, transaction, adapter, execute, send } = setup();
    await send({ begin: {} });
    await send({ create: query });
    await send({ findOne: { ...query, populate: [], embeddingsAllowedFields: [] } });
    await send({ commit: {} });

    expect(execute.mock.calls.map(c => c[0])).toEqual(['create', 'findOne']);
    expect(execute.mock.calls[0][2]).toBe(transaction);
    expect(call.written).toEqual([
      { result: '' },
      { result: '"create"' },
      { result: '"findOne"' },
      { result: '' },
    ]);
    expect(adapter.commitTransaction).toHaveBeenCalledTimes(1);
    expect(adapter.rollbackTransaction).not.toHaveBeenCalled();
    expect(call.ended).toBe(true);
    expect(call.failure).toBeUndefined();
  });

  it('handles messages one at a time, in order', async () => {
    const order: string[] = [];
    const { call, stream } = setup({
      execute: async operation => {
        order.push(`start ${operation}`);
        await new Promise(resolve =>
          setTimeout(resolve, operation === 'create' ? 20 : 0),
        );
        order.push(`end ${operation}`);
        return '1';
      },
    });
    call.emit('data', { begin: {} });
    call.emit('data', { create: query });
    call.emit('data', { deleteOne: query });
    await stream.idle();
    expect(order).toEqual([
      'start create',
      'end create',
      'start deleteOne',
      'end deleteOne',
    ]);
  });

  it('reads the operation by name, whatever else the decoded message holds', async () => {
    const { call, execute, send } = setup();
    await send({ operation: 'begin', begin: {} } as never);
    await send({ operation: 'create', create: query } as never);
    expect(execute.mock.calls.map(c => c[0])).toEqual(['create']);
    expect(call.failure).toBeUndefined();
  });

  it('refuses a stream that does not start with begin', async () => {
    const { call, adapter, send } = setup();
    await send({ create: query });
    expect(call.failure?.code).toBe(status.FAILED_PRECONDITION);
    expect(adapter.beginTransaction).not.toHaveBeenCalled();
  });

  it('refuses to begin when the database has no transaction support', async () => {
    const { call, adapter, send } = setup();
    adapter.getTransactionSupport.mockResolvedValue({
      supported: false,
      message: 'Transactions require a replica set',
    } as never);
    await send({ begin: {} });
    expect(call.failure).toMatchObject({
      code: status.FAILED_PRECONDITION,
      message: 'Transactions require a replica set',
    });
    expect(adapter.beginTransaction).not.toHaveBeenCalled();
  });

  it('rolls back and reports the status of a failed operation', async () => {
    const { call, adapter, execute, send } = setup();
    execute.mockRejectedValueOnce({ code: status.PERMISSION_DENIED, message: 'nope' });
    await send({ begin: {} });
    await send({ create: query });
    expect(adapter.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(call.failure).toMatchObject({
      code: status.PERMISSION_DENIED,
      message: 'nope',
    });

    await send({ commit: {} });
    expect(adapter.commitTransaction).not.toHaveBeenCalled();
    expect(call.written).toEqual([{ result: '' }]);
  });

  it('reports a failure the database would lift on retry as ABORTED', async () => {
    const { call, transaction, execute, send } = setup();
    execute.mockImplementationOnce(async () => {
      transaction.recordFailure({ errorLabels: ['TransientTransactionError'] });
      throw { code: status.INTERNAL, message: 'Write conflict' };
    });
    await send({ begin: {} });
    await send({ updateOne: { ...query, filterQuery: '{}', populate: [] } });
    expect(call.failure).toMatchObject({
      code: status.ABORTED,
      message: 'Write conflict',
    });
  });

  it('rolls back on an explicit rollback', async () => {
    const { call, adapter, send } = setup();
    await send({ begin: {} });
    await send({ rollback: {} });
    expect(adapter.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(adapter.commitTransaction).not.toHaveBeenCalled();
    expect(call.written).toEqual([{ result: '' }, { result: '' }]);
    expect(call.ended).toBe(true);
  });

  it.each(['end', 'cancelled'])(
    'rolls back when the client goes away (%s)',
    async event => {
      const { call, adapter, stream, send } = setup();
      await send({ begin: {} });
      await send({ create: query });
      call.emit(event);
      await stream.idle();
      expect(adapter.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(adapter.commitTransaction).not.toHaveBeenCalled();
    },
  );

  it('rolls back when the commit fails', async () => {
    const { call, adapter, send } = setup();
    adapter.commitTransaction.mockRejectedValue(new Error('commit failed') as never);
    await send({ begin: {} });
    await send({ commit: {} });
    expect(adapter.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(call.failure).toMatchObject({
      code: status.INTERNAL,
      message: 'commit failed',
    });
  });

  it('holds side effects until the commit and drops them on rollback', async () => {
    const effect = jest.fn();
    const committed = setup({
      execute: async (_operation, _request, transaction) => {
        transaction.afterCommit(effect);
        return '1';
      },
    });
    await committed.send({ begin: {} });
    await committed.send({ create: query });
    expect(effect).not.toHaveBeenCalled();
    await committed.send({ commit: {} });
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('reports follow-up actions that fail after the commit without failing it', async () => {
    const onAfterCommitErrors = jest.fn();
    const { call, send } = setup({
      onAfterCommitErrors,
      execute: async (_operation, _request, transaction) => {
        transaction.afterCommit(() => {
          throw new Error('bus down');
        });
        return '1';
      },
    });
    await send({ begin: {} });
    await send({ create: query });
    await send({ commit: {} });
    expect(call.failure).toBeUndefined();
    expect(onAfterCommitErrors).toHaveBeenCalledWith([new Error('bus down')]);
  });

  it('rolls back a transaction that outlives its lifetime', async () => {
    const { call, adapter, stream, send } = setup({ maxDurationMs: 30 });
    await send({ begin: { timeoutMs: 10_000 } });
    await new Promise(resolve => setTimeout(resolve, 80));
    await stream.idle();
    expect(adapter.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(call.failure?.code).toBe(status.DEADLINE_EXCEEDED);
  });
});
