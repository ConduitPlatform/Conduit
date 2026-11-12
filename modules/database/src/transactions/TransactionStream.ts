import { status } from '@grpc/grpc-js';
import { DatabaseTransaction, TransactionSupport } from './DatabaseTransaction.js';
import { isRetryableTransactionError } from './errors.js';
import { TransactionRequest, TransactionResponse } from '../protoTypes/database.js';

export type TransactionOperation = Exclude<
  keyof TransactionRequest,
  'begin' | 'commit' | 'rollback'
>;

type GrpcStatus = { code: status; message: string };

/** The part of a gRPC duplex call the transaction stream relies on. */
export interface TransactionCall {
  on(event: 'data', listener: (message: TransactionRequest) => void): unknown;
  on(event: 'end' | 'cancelled', listener: () => void): unknown;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  write(message: TransactionResponse): unknown;
  end(): unknown;
  emit(event: 'error', error: GrpcStatus & { details: string }): unknown;
}

export interface TransactionStreamOptions {
  adapter: {
    getTransactionSupport(): Promise<TransactionSupport>;
    beginTransaction(): Promise<DatabaseTransaction>;
    commitTransaction(transaction: DatabaseTransaction): Promise<Error[]>;
    rollbackTransaction(transaction: DatabaseTransaction): Promise<void>;
  };
  /** Runs one operation inside the transaction. Rejects with a gRPC status. */
  execute(
    operation: TransactionOperation,
    request: unknown,
    transaction: DatabaseTransaction,
  ): Promise<string>;
  /** Upper bound for the lifetime of a transaction. */
  maxDurationMs: number;
  onAfterCommitErrors?(errors: Error[]): void;
  onRollbackError?(error: unknown): void;
}

const OPERATIONS: readonly (keyof TransactionRequest)[] = [
  'begin',
  'commit',
  'rollback',
  'findOne',
  'findMany',
  'create',
  'createMany',
  'deleteOne',
  'deleteMany',
  'findByIdAndUpdate',
  'findByIdAndReplace',
  'updateMany',
  'updateOne',
  'replaceOne',
  'countDocuments',
];

/**
 * The one operation a message carries. Looked up by name: the decoded message can
 * hold other keys (the proto loader adds the oneof's own discriminator).
 */
function operationOf(message: TransactionRequest): keyof TransactionRequest | undefined {
  return OPERATIONS.find(key => message[key] !== undefined && message[key] !== null);
}

function messageOf(error: unknown): string {
  const message = (error as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' ? message : String(error);
}

/** Driver errors carry their own numeric codes, so they never pass as a gRPC status. */
function internalStatus(error: unknown): GrpcStatus {
  return { code: status.INTERNAL, message: messageOf(error) };
}

/** `execute` rejects with the status its gRPC handler produced. */
function operationStatus(error: unknown): GrpcStatus {
  const code = (error as { code?: unknown } | undefined)?.code;
  return {
    code: typeof code === 'number' && code in status ? code : status.INTERNAL,
    message: messageOf(error),
  };
}

/**
 * Drives one interactive transaction over a bidirectional gRPC stream. The stream
 * stays on a single Database instance, which is what lets the transaction keep its
 * connection across calls.
 *
 * Messages are handled strictly one at a time and each gets exactly one response.
 * Anything other than a commit (a failed operation, an explicit rollback, the
 * client going away, the lifetime running out) rolls the transaction back.
 */
export class TransactionStream {
  private queue: Promise<void> = Promise.resolve();
  private state: 'idle' | 'open' | 'closed' = 'idle';
  private transaction?: DatabaseTransaction;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly call: TransactionCall,
    private readonly options: TransactionStreamOptions,
  ) {}

  start() {
    this.call.on('data', message => this.enqueue(() => this.handle(message)));
    this.call.on('end', () =>
      this.enqueue(async () => {
        if (this.state === 'closed') return;
        await this.rollback();
        this.call.end();
      }),
    );
    this.call.on('cancelled', () => this.enqueue(() => this.rollback()));
    this.call.on('error', () => this.enqueue(() => this.rollback()));
  }

  /** Resolves once everything received so far has been handled. */
  idle(): Promise<void> {
    return this.queue;
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue
      .then(task)
      .catch(error => this.fail(internalStatus(error)))
      .catch(() => {});
  }

  private async handle(message: TransactionRequest) {
    if (this.state === 'closed') return;
    const operation = operationOf(message);
    if (!operation) {
      return this.fail({
        code: status.INVALID_ARGUMENT,
        message: 'Transaction message carries no operation',
      });
    }
    if (this.state === 'idle') {
      if (operation !== 'begin') {
        return this.fail({
          code: status.FAILED_PRECONDITION,
          message: 'A transaction stream must start with begin',
        });
      }
      return this.begin(message.begin?.timeoutMs);
    }
    switch (operation) {
      case 'begin':
        return this.fail({
          code: status.FAILED_PRECONDITION,
          message: 'Transaction has already begun',
        });
      case 'commit':
        return this.commit();
      case 'rollback':
        await this.rollback();
        this.call.write({ result: '' });
        this.call.end();
        return;
      default:
        return this.run(operation, message[operation]);
    }
  }

  private async begin(requestedTimeoutMs?: number) {
    const support = await this.options.adapter.getTransactionSupport();
    if (!support.supported) {
      return this.fail({
        code: status.FAILED_PRECONDITION,
        message: support.message ?? 'Transactions are not supported by this database',
      });
    }
    this.transaction = await this.options.adapter.beginTransaction();
    this.state = 'open';
    const max = this.options.maxDurationMs;
    const duration =
      requestedTimeoutMs && requestedTimeoutMs > 0
        ? Math.min(requestedTimeoutMs, max)
        : max;
    this.timer = setTimeout(
      () =>
        this.enqueue(async () => {
          if (this.state !== 'open') return;
          await this.fail({
            code: status.DEADLINE_EXCEEDED,
            message: `Transaction exceeded its ${duration}ms lifetime and was rolled back`,
          });
        }),
      duration,
    );
    this.timer.unref?.();
    this.call.write({ result: '' });
  }

  private async run(operation: TransactionOperation, request: unknown) {
    const transaction = this.transaction!;
    try {
      const result = await this.options.execute(operation, request, transaction);
      if (this.state !== 'open') return;
      this.call.write({ result });
    } catch (error) {
      await this.fail(this.failureStatus(operationStatus(error), transaction));
    }
  }

  private async commit() {
    const transaction = this.transaction!;
    this.close();
    let hookErrors: Error[];
    try {
      hookErrors = await this.options.adapter.commitTransaction(transaction);
    } catch (error) {
      transaction.recordFailure(error);
      await this.options.adapter
        .rollbackTransaction(transaction)
        .catch(e => this.options.onRollbackError?.(e));
      return this.sendError(this.failureStatus(internalStatus(error), transaction));
    }
    if (hookErrors.length) this.options.onAfterCommitErrors?.(hookErrors);
    this.call.write({ result: '' });
    this.call.end();
  }

  /** A failure the database would lift on a retry is reported as ABORTED. */
  private failureStatus(
    failure: GrpcStatus,
    transaction: DatabaseTransaction,
  ): GrpcStatus {
    if (isRetryableTransactionError(transaction.failure)) {
      return { code: status.ABORTED, message: failure.message };
    }
    return failure;
  }

  private async fail(failure: GrpcStatus) {
    if (this.state === 'closed') return;
    await this.rollback();
    this.sendError(failure);
  }

  private async rollback() {
    const transaction = this.transaction;
    const wasOpen = this.state === 'open';
    this.close();
    if (!wasOpen || !transaction) return;
    await this.options.adapter
      .rollbackTransaction(transaction)
      .catch(e => this.options.onRollbackError?.(e));
  }

  private close() {
    this.state = 'closed';
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private sendError(failure: GrpcStatus) {
    this.call.emit('error', { ...failure, details: failure.message });
  }
}
