import { UntypedArray } from '../../interfaces/index.js';
import { Query } from '../../types/db.js';
import { AuthzOptions, PopulateAuthzOptions } from '../../types/options.js';
import type { FindManyOptions, FindOneOptions } from './types.js';
import {
  CountDocumentsOptions,
  findManyRequest,
  findOneRequest,
  queryRequest,
  updateManyRequest,
  updateRequest,
} from './requests.js';
import { getLogger } from '../../utilities/GrpcSdkContext.js';
import type {
  TransactionRequest,
  TransactionResponse,
} from '../../protoUtils/database.js';

export type TransactionOptions = {
  /**
   * Lifetime of the transaction in milliseconds, after which Database rolls it
   * back. Capped by Database's `transactions.maxDurationMs`.
   */
  timeoutMs?: number;
  /**
   * How many times to run the work again when the database rejects the
   * transaction for a passing reason (write conflict, deadlock, serialization
   * failure). The work then runs more than once, so only raise this when
   * everything it does outside the transaction is safe to repeat. Defaults to 0.
   */
  retries?: number;
};

/**
 * The query methods shared by `DatabaseProvider` and `DatabaseTransaction`: what the
 * work of `withOptionalTransaction` receives, whether or not a transaction is open.
 */
export interface DatabaseOperations {
  findOne<T>(schemaName: string, query: Query<T>, options?: FindOneOptions): Promise<T>;
  findMany<T>(
    schemaName: string,
    query: Query<T>,
    options?: FindManyOptions,
  ): Promise<T[]>;
  create<T>(schemaName: string, query: Query<T>, options?: AuthzOptions): Promise<T>;
  createMany<T>(
    schemaName: string,
    query: Query<T>[],
    options?: AuthzOptions,
  ): Promise<T[] | UntypedArray>;
  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any>;
  findByIdAndReplace<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any>;
  updateMany<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<any>;
  updateOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<any>;
  replaceOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<any>;
  deleteOne<T>(schemaName: string, query: Query<T>, options?: AuthzOptions): Promise<any>;
  deleteMany<T>(
    schemaName: string,
    query: Query<T>,
    options?: AuthzOptions,
  ): Promise<any>;
  countDocuments<T>(
    schemaName: string,
    query: Query<T>,
    options?: CountDocumentsOptions,
  ): Promise<number>;
}

const GRPC_STATUS_FAILED_PRECONDITION = 9;
const GRPC_STATUS_ABORTED = 10;
const GRPC_STATUS_UNIMPLEMENTED = 12;

/**
 * Database turned the transaction down before it began: the database cannot run
 * one (standalone MongoDB), or this Database predates transactions.
 */
export class TransactionUnavailableError extends Error {
  constructor(readonly reason: unknown) {
    super(
      (reason as { details?: string; message?: string })?.details ??
        (reason as Error)?.message ??
        'Transactions are not available',
    );
    this.name = 'TransactionUnavailableError';
  }
}

function isUnavailableStatus(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return code === GRPC_STATUS_FAILED_PRECONDITION || code === GRPC_STATUS_UNIMPLEMENTED;
}

/** Database reports a transaction that is worth running again as ABORTED. */
export function isRetryableTransactionError(error: unknown): boolean {
  return (error as { code?: unknown } | undefined)?.code === GRPC_STATUS_ABORTED;
}

type TransactionMessage = { [K in keyof TransactionRequest]?: object };

/** Opens the transaction stream; requests go in, one response comes back for each. */
export type TransactionStreamOpener = (
  requests: AsyncIterable<TransactionMessage>,
) => AsyncIterable<TransactionResponse>;

class RequestQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private waiting?: (result: IteratorResult<T>) => void;
  private ended = false;

  push(item: T) {
    if (this.ended) return;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = undefined;
      resolve({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  end() {
    this.ended = true;
    this.waiting?.({ value: undefined, done: true });
    this.waiting = undefined;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length) {
          return Promise.resolve({ value: this.items.shift()!, done: false });
        }
        if (this.ended) return Promise.resolve({ value: undefined, done: true });
        return new Promise(resolve => (this.waiting = resolve));
      },
      return: () => {
        this.end();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}

/**
 * A database transaction in progress, as handed to the callback of
 * `DatabaseProvider.withTransaction`. Its query methods mirror the provider's,
 * and run inside the transaction.
 *
 * A failed call rolls the whole transaction back: every later call, and the
 * commit, then fail too.
 */
export class DatabaseTransaction implements DatabaseOperations {
  private readonly requests = new RequestQueue<TransactionMessage>();
  private responses?: AsyncIterator<TransactionResponse>;
  private pending: Promise<unknown> = Promise.resolve();
  private state: 'new' | 'open' | 'ended' = 'new';
  private failure?: unknown;
  private readonly commitHooks: Array<() => unknown> = [];

  constructor(private readonly open: TransactionStreamOpener) {}

  /**
   * Registers work to run once the transaction has committed, such as dropping a
   * cache entry for a document it changed. Hooks do not run on a rollback, and a
   * failing hook is logged without failing the committed transaction.
   */
  onCommit(hook: () => unknown) {
    this.commitHooks.push(hook);
  }

  /** @internal */
  async begin(timeoutMs?: number) {
    if (this.state !== 'new') throw new Error('Transaction has already begun');
    this.state = 'open';
    this.responses = this.open(this.requests)[Symbol.asyncIterator]();
    try {
      await this.send({ begin: { timeoutMs } });
    } catch (e) {
      // Nothing has run yet, so the caller may still do the work another way.
      throw isUnavailableStatus(e) ? new TransactionUnavailableError(e) : e;
    }
  }

  /** @internal */
  async commit() {
    await this.send({ commit: {} });
    await this.finish();
    for (const hook of this.commitHooks.splice(0)) {
      try {
        await hook();
      } catch (e) {
        getLogger().error(
          `A follow-up action of a committed transaction failed: ${(e as Error)?.message ?? e}`,
        );
      }
    }
  }

  /** @internal Does nothing once the transaction has ended. */
  async rollback() {
    if (this.state !== 'open') return;
    try {
      await this.send({ rollback: {} });
    } finally {
      await this.finish();
    }
  }

  findOne<T>(schemaName: string, query: Query<T>, options?: FindOneOptions): Promise<T> {
    return this.query({ findOne: findOneRequest(schemaName, query, options) });
  }

  findMany<T>(
    schemaName: string,
    query: Query<T>,
    options?: FindManyOptions,
  ): Promise<T[]> {
    return this.query({ findMany: findManyRequest(schemaName, query, options) });
  }

  create<T>(schemaName: string, query: Query<T>, options?: AuthzOptions): Promise<T> {
    return this.query({ create: queryRequest(schemaName, query, options) });
  }

  createMany<T>(
    schemaName: string,
    query: Query<T>[],
    options?: AuthzOptions,
  ): Promise<T[] | UntypedArray> {
    return this.query({ createMany: queryRequest(schemaName, query, options) });
  }

  findByIdAndUpdate<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any> {
    return this.query({
      findByIdAndUpdate: updateRequest(schemaName, id, document, options),
    });
  }

  findByIdAndReplace<T>(
    schemaName: string,
    id: string,
    document: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<T | any> {
    return this.query({
      findByIdAndReplace: updateRequest(schemaName, id, document, options),
    });
  }

  updateMany<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<any> {
    return this.query({
      updateMany: updateManyRequest(schemaName, filterQuery, query, options),
    });
  }

  updateOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<any> {
    return this.query({
      updateOne: updateManyRequest(schemaName, filterQuery, query, options),
    });
  }

  replaceOne<T>(
    schemaName: string,
    filterQuery: Query<T>,
    query: Query<T>,
    options?: PopulateAuthzOptions,
  ): Promise<any> {
    return this.query({
      replaceOne: updateManyRequest(schemaName, filterQuery, query, options),
    });
  }

  deleteOne<T>(
    schemaName: string,
    query: Query<T>,
    options?: AuthzOptions,
  ): Promise<any> {
    return this.query({ deleteOne: queryRequest(schemaName, query, options) });
  }

  deleteMany<T>(
    schemaName: string,
    query: Query<T>,
    options?: AuthzOptions,
  ): Promise<any> {
    return this.query({ deleteMany: queryRequest(schemaName, query, options) });
  }

  countDocuments<T>(
    schemaName: string,
    query: Query<T>,
    options?: CountDocumentsOptions,
  ): Promise<number> {
    return this.query({ countDocuments: queryRequest(schemaName, query, options) });
  }

  private query<R>(message: TransactionMessage): Promise<R> {
    return this.send(message).then(result => JSON.parse(result));
  }

  /** Sends one message and waits for its response. Messages go out one at a time. */
  private send(message: TransactionMessage): Promise<string> {
    const exchange = async () => {
      if (this.failure) throw this.failure;
      if (this.state !== 'open') throw new Error('Transaction is not open');
      this.requests.push(message);
      try {
        const response = await this.responses!.next();
        if (response.done) throw new Error('Transaction stream closed unexpectedly');
        return response.value.result;
      } catch (e) {
        // Database has rolled back and closed the stream.
        this.failure = e;
        this.state = 'ended';
        this.requests.end();
        throw e;
      }
    };
    const result = this.pending.then(exchange);
    this.pending = result.catch(() => {});
    return result;
  }

  /** Closes our side and lets the stream run to its end. */
  private async finish() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.requests.end();
    try {
      let response = await this.responses!.next();
      while (!response.done) response = await this.responses!.next();
    } catch {
      // The outcome was already delivered with the commit or rollback response.
    }
  }
}
