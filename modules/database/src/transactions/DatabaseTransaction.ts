export type TransactionSupport = {
  supported: boolean;
  /** Why transactions are unavailable. */
  message?: string;
};

type AfterCommitHook = () => unknown | Promise<unknown>;

/**
 * An open database transaction, handed to schema adapters through their
 * `transaction` option. `native` is the driver handle: a MongoDB `ClientSession`
 * or a Sequelize `Transaction`.
 *
 * Side effects that live outside the database (bus events, authorization
 * relations) are registered with `afterCommit` so a rollback leaves none behind.
 */
export class DatabaseTransaction<N = unknown> {
  private readonly hooks: AfterCommitHook[] = [];

  /** The driver error of the operation that broke the transaction, if any. */
  failure?: unknown;

  constructor(readonly native: N) {}

  recordFailure(error: unknown) {
    this.failure ??= error;
  }

  afterCommit(hook: AfterCommitHook) {
    this.hooks.push(hook);
  }

  /** Runs the hooks in registration order. A failing hook does not stop the rest. */
  async runAfterCommit(): Promise<Error[]> {
    const errors: Error[] = [];
    for (const hook of this.hooks.splice(0)) {
      try {
        await hook();
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
    }
    return errors;
  }

  discardAfterCommit() {
    this.hooks.length = 0;
  }
}

/** The transaction a gRPC handler runs in, when it was invoked from a transaction stream. */
export function transactionOf(call: object): DatabaseTransaction | undefined {
  return (call as { transaction?: DatabaseTransaction }).transaction;
}
