import { ConduitGrpcSdk, Indexable, isLockContention } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { File, _StorageCdnState } from '../models/index.js';
import { replaceUrlHost } from '../utils/index.js';

export type CdnConfiguration = Record<string, string>;

export const CDN_RECONCILIATION_LOCK = 'storage:cdn-reconciliation';
export const CDN_RECONCILIATION_LOCK_TTL_MS = 10_000;
export const CDN_RECONCILIATION_BATCH_SIZE = 200;
const MAX_CONFIG_RETARGETS = 3;
const MAX_RECONCILIATION_PASSES = 4;
export const CDN_WRITE_CONCURRENCY = 10;
export const CDN_RETRY_DELAY_MS = 30_000;
const MAX_CDN_RETRIES = 5;

export type CdnStateRecord = {
  container: string;
  status: string;
  appliedHost?: string;
  targetHost?: string;
  checkpointId?: string;
};

export type CdnFileRecord = {
  _id: string;
  url?: string;
  sourceUrl?: string;
};

export type CdnFileQueryOptions = {
  skip: number;
  limit: number;
  sort: { _id: 1 };
  select: string;
  readPreference?: string;
};

export interface CdnReconciliationDeps {
  readConfig: () => CdnConfiguration;
  loadStates: () => Promise<CdnStateRecord[]>;
  findState: (container: string) => Promise<CdnStateRecord | null>;
  createState: (doc: CdnStateRecord) => Promise<unknown>;
  updateState: (container: string, patch: Partial<CdnStateRecord>) => Promise<unknown>;
  findFiles: (query: Indexable, options: CdnFileQueryOptions) => Promise<CdnFileRecord[]>;
  /** Writes nextUrl only if the url is still observedUrl. Resolves false on a miss. */
  updateFileUrl: (
    id: string,
    observedUrl: string | null,
    nextUrl: string,
  ) => Promise<boolean>;
  usingLock: <T>(
    resource: string,
    ttl: number,
    fn: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  batchSize?: number;
  /** Containers to rescan even if their persisted state says complete. */
  force?: string[];
}

/**
 * Public files that have a provider sourceUrl. Missing, null, and empty sources
 * are excluded: the current url is not a provider source once a CDN host is in it.
 */
export function publicFilesWithProviderSourceQuery(container: string, afterId?: string) {
  return {
    container,
    isPublic: true,
    $and: [
      { sourceUrl: { $exists: true } },
      { sourceUrl: { $ne: null } },
      { sourceUrl: { $ne: '' } },
    ],
    ...(afterId ? { _id: { $gt: afterId } } : {}),
  };
}

function cdnHostOf(config: CdnConfiguration, container: string): string {
  const value = config[container];
  return typeof value === 'string' ? value : '';
}

/**
 * Desired public url from the provider source. An empty host restores sourceUrl
 * exactly, including SAS query parameters. A configured host replaces only the
 * authority. Invalid sources throw so the caller does not invent a url.
 */
export function reconciledFileUrl(sourceUrl: string, cdnHost: string): string {
  if (!cdnHost) return sourceUrl;
  return replaceUrlHost(sourceUrl, cdnHost);
}

export function reconciliationContainers(
  config: CdnConfiguration,
  states: Array<Pick<CdnStateRecord, 'container'>>,
): string[] {
  return [
    ...new Set([...Object.keys(config), ...states.map(state => state.container)]),
  ].sort();
}

function throwIfLeaseLost(signal: AbortSignal) {
  if (signal.aborted) throw new Error('CDN reconciliation lease expired');
}

function isApplied(state: CdnStateRecord | undefined, host: string): boolean {
  return state?.status === 'complete' && state.appliedHost === host;
}

type PageCounts = { updated: number; unchanged: number; skipped: number };

/**
 * Rewrites one page in concurrent chunks. Each write is conditional on the url that was
 * read, so a row changed by someone else is skipped, not overwritten.
 */
async function reconcilePage(
  deps: CdnReconciliationDeps,
  container: string,
  files: CdnFileRecord[],
  host: string,
): Promise<PageCounts> {
  const counts: PageCounts = { updated: 0, unchanged: 0, skipped: 0 };
  const rewrite = async (file: CdnFileRecord) => {
    let nextUrl: string;
    try {
      if (!file.sourceUrl) throw new Error('missing sourceUrl');
      nextUrl = reconciledFileUrl(file.sourceUrl, host);
    } catch (error) {
      ConduitGrpcSdk.Logger?.warn(
        `CDN reconciliation skipped file ${file._id} in container "${container}": invalid sourceUrl (${(error as Error).message})`,
      );
      counts.skipped += 1;
      return;
    }
    const observedUrl = file.url ?? null;
    if (nextUrl === observedUrl) {
      counts.unchanged += 1;
      return;
    }
    if (await deps.updateFileUrl(file._id, observedUrl, nextUrl)) {
      counts.updated += 1;
    } else {
      ConduitGrpcSdk.Logger?.warn(
        `CDN reconciliation skipped file ${file._id} in container "${container}": url changed concurrently`,
      );
      counts.skipped += 1;
    }
  };
  for (let i = 0; i < files.length; i += CDN_WRITE_CONCURRENCY) {
    await Promise.all(files.slice(i, i + CDN_WRITE_CONCURRENCY).map(rewrite));
  }
  return counts;
}

async function reconcileContainer(
  deps: CdnReconciliationDeps,
  signal: AbortSignal,
  container: string,
  force: boolean,
): Promise<void> {
  throwIfLeaseLost(signal);
  const state = await deps.findState(container);
  let desired = cdnHostOf(deps.readConfig(), container);
  if (!force && isApplied(state ?? undefined, desired)) return;

  // Resume only a pending pass that was already working towards this host.
  let afterId =
    !force && state?.status === 'pending' && state.targetHost === desired
      ? state.checkpointId || ''
      : '';
  const pending = { status: 'pending', targetHost: desired, checkpointId: afterId };
  if (state) await deps.updateState(container, pending);
  else await deps.createState({ container, ...pending });

  const batchSize = deps.batchSize ?? CDN_RECONCILIATION_BATCH_SIZE;
  const total: PageCounts = { updated: 0, unchanged: 0, skipped: 0 };
  let retargets = 0;
  ConduitGrpcSdk.Logger?.log(`Reconciling CDN urls for container "${container}"`);

  for (;;) {
    throwIfLeaseLost(signal);
    const live = cdnHostOf(deps.readConfig(), container);
    if (live !== desired) {
      if (++retargets > MAX_CONFIG_RETARGETS) {
        throw new Error(
          `CDN configuration for container ${container} changed during reconciliation`,
        );
      }
      desired = live;
      afterId = '';
      await deps.updateState(container, {
        status: 'pending',
        targetHost: desired,
        checkpointId: '',
      });
      continue;
    }

    const files = await deps.findFiles(
      publicFilesWithProviderSourceQuery(container, afterId),
      {
        skip: 0,
        limit: batchSize,
        sort: { _id: 1 },
        select: '_id url sourceUrl',
        readPreference: 'primary',
      },
    );
    throwIfLeaseLost(signal);
    const page = await reconcilePage(deps, container, files, desired);
    total.updated += page.updated;
    total.unchanged += page.unchanged;
    total.skipped += page.skipped;
    throwIfLeaseLost(signal);

    if (files.length < batchSize) {
      await deps.updateState(container, {
        status: 'complete',
        appliedHost: desired,
        targetHost: '',
        checkpointId: '',
      });
      ConduitGrpcSdk.Logger?.log(
        `CDN reconciliation completed for container "${container}": ${total.updated} updated, ${total.unchanged} unchanged, ${total.skipped} skipped`,
      );
      return;
    }
    afterId = files[files.length - 1]!._id;
    await deps.updateState(container, {
      status: 'pending',
      targetHost: desired,
      checkpointId: afterId,
    });
  }
}

/**
 * Passes repeat while config changes underneath them, which also picks up
 * containers added mid-pass and hosts that changed after a container completed.
 */
async function reconcileUnderLock(
  deps: CdnReconciliationDeps,
  signal: AbortSignal,
): Promise<void> {
  for (let pass = 0; pass < MAX_RECONCILIATION_PASSES; pass += 1) {
    const config = deps.readConfig();
    const containers = reconciliationContainers(config, await deps.loadStates());
    for (const container of containers) {
      await reconcileContainer(
        deps,
        signal,
        container,
        pass === 0 && !!deps.force?.includes(container),
      );
    }
    throwIfLeaseLost(signal);
    const states = await deps.loadStates();
    const settled = reconciliationContainers(deps.readConfig(), states).every(container =>
      isApplied(
        states.find(state => state.container === container),
        cdnHostOf(deps.readConfig(), container),
      ),
    );
    if (settled) return;
  }
  throw new Error('CDN configuration changed during reconciliation');
}

export type ReconciliationOutcome = 'done' | 'busy';

export async function reconcileCdnConfiguration(
  deps: CdnReconciliationDeps,
): Promise<ReconciliationOutcome> {
  let entered = false;
  try {
    await deps.usingLock(
      CDN_RECONCILIATION_LOCK,
      CDN_RECONCILIATION_LOCK_TTL_MS,
      async signal => {
        entered = true;
        await reconcileUnderLock(deps, signal);
      },
    );
    return 'done';
  } catch (error) {
    // Only a genuinely held lock means another replica is reconciling. Redis
    // failures and errors after acquisition, lease loss included, are real.
    if (!entered && (await isLockContention(error))) {
      ConduitGrpcSdk.Logger?.log(
        'CDN reconciliation is already running on another replica, skipping',
      );
      return 'busy';
    }
    throw error;
  }
}

function isMissingDocument(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('Document not found') ||
      error.message.includes("Document doesn't exist or can't be modified by user."))
  );
}

export async function reconcileStoredCdnConfig(
  grpcSdk: ConduitGrpcSdk,
  force: string[] = [],
): Promise<ReconciliationOutcome> {
  if (!grpcSdk.state) {
    throw new Error('CDN reconciliation requires state locks');
  }
  const files = File.getInstance();
  const states = _StorageCdnState.getInstance();
  return reconcileCdnConfiguration({
    force,
    readConfig: () =>
      (ConfigController.getInstance().config.cdnConfiguration ?? {}) as CdnConfiguration,
    loadStates: () => states.findMany({}, { readPreference: 'primary' }),
    findState: container => states.findOne({ container }, { readPreference: 'primary' }),
    createState: doc => states.create(doc),
    updateState: (container, patch) => states.updateOne({ container }, patch),
    findFiles: (query, options) => files.findMany(query, options),
    updateFileUrl: async (id, observedUrl, nextUrl) => {
      try {
        // Mongo returns null on a miss, SQL throws.
        const updated = await files.updateOne(
          { _id: id, url: observedUrl } as Indexable,
          { url: nextUrl },
        );
        return updated != null;
      } catch (error) {
        if (isMissingDocument(error)) return false;
        throw error;
      }
    },
    usingLock: (resource, ttl, fn) => grpcSdk.state!.usingLock(resource, ttl, fn),
  });
}

/** Containers whose host differs between two snapshots. */
export function changedCdnContainers(
  previous: CdnConfiguration,
  current: CdnConfiguration,
): string[] {
  return reconciliationContainers(
    current,
    Object.keys(previous).map(container => ({ container })),
  ).filter(container => cdnHostOf(previous, container) !== cdnHostOf(current, container));
}

/**
 * Runs reconciliation for one Storage instance.
 *
 * Config is published to other replicas only after this replica's onConfig
 * returns, so uploads elsewhere (and in-flight uploads here) can write the old
 * host behind a finished scan. A runtime run therefore rescans every container
 * whose host differs from the last snapshot this instance applied, even if the
 * persisted state says complete. At boot there is no snapshot and persisted
 * state decides.
 *
 * Boot failures reject so the process exits before SERVING and the next start
 * retries. Runtime failures are logged. A busy lock or a failed runtime run is
 * retried later, since the lock holder may die before finishing.
 */
export class CdnReconciliationRunner {
  private lastApplied?: CdnConfiguration;
  private timer?: NodeJS.Timeout;
  private retries = 0;

  constructor(
    private readonly reconcile: (force: string[]) => Promise<ReconciliationOutcome>,
    private readonly readConfig: () => CdnConfiguration,
    private readonly retryDelayMs = CDN_RETRY_DELAY_MS,
  ) {}

  async run(failOnError: boolean): Promise<void> {
    this.cancel();
    this.retries = 0;
    await this.execute(failOnError);
  }

  cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async execute(failOnError: boolean): Promise<void> {
    const current = { ...this.readConfig() };
    const force = this.lastApplied ? changedCdnContainers(this.lastApplied, current) : [];
    let outcome: ReconciliationOutcome | 'failed';
    try {
      outcome = await this.reconcile(force);
    } catch (error) {
      if (failOnError) throw error;
      ConduitGrpcSdk.Logger?.error(
        `CDN reconciliation failed: ${(error as Error).message}`,
      );
      outcome = 'failed';
    }
    if (outcome === 'done' || failOnError) this.lastApplied = current;
    if (outcome !== 'done') this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.retries >= MAX_CDN_RETRIES) return;
    this.retries += 1;
    this.timer = setTimeout(
      () => void this.execute(false),
      this.retryDelayMs * this.retries,
    );
    this.timer.unref();
  }
}
