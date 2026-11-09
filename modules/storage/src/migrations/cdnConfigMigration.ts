import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { File, _StorageCdnState } from '../models/index.js';
import { replaceUrlHost } from '../utils/index.js';

export type CdnConfiguration = Record<string, string>;

export const CDN_RECONCILIATION_LOCK = 'storage:cdn-reconciliation';
export const CDN_RECONCILIATION_LOCK_TTL_MS = 10_000;
export const CDN_RECONCILIATION_BATCH_SIZE = 200;
const MAX_CONFIG_RETARGETS = 3;
const MAX_RECONCILIATION_PASSES = 4;

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
 * Rewrites one page concurrently. Each write is conditional on the url that was
 * read, so a row changed by someone else is skipped, not overwritten.
 */
async function reconcilePage(
  deps: CdnReconciliationDeps,
  container: string,
  files: CdnFileRecord[],
  host: string,
): Promise<PageCounts> {
  const counts: PageCounts = { updated: 0, unchanged: 0, skipped: 0 };
  await Promise.all(
    files.map(async file => {
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
    }),
  );
  return counts;
}

async function reconcileContainer(
  deps: CdnReconciliationDeps,
  signal: AbortSignal,
  container: string,
): Promise<void> {
  throwIfLeaseLost(signal);
  const state = await deps.findState(container);
  let desired = cdnHostOf(deps.readConfig(), container);
  if (isApplied(state ?? undefined, desired)) return;

  // Resume only a pending pass that was already working towards this host.
  let afterId =
    state?.status === 'pending' && state.targetHost === desired
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
      await reconcileContainer(deps, signal, container);
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

function isLockContention(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ExecutionError' || /unable to achieve a quorum/i.test(error.message))
  );
}

export async function reconcileCdnConfiguration(
  deps: CdnReconciliationDeps,
): Promise<void> {
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
  } catch (error) {
    // Failing to acquire the lock means another replica is reconciling.
    // Errors after acquisition, lease loss included, are real failures.
    if (!entered && isLockContention(error)) {
      ConduitGrpcSdk.Logger?.log(
        'CDN reconciliation is already running on another replica, skipping',
      );
      return;
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

export async function reconcileStoredCdnConfig(grpcSdk: ConduitGrpcSdk): Promise<void> {
  if (!grpcSdk.state) {
    throw new Error('CDN reconciliation requires state locks');
  }
  const files = File.getInstance();
  const states = _StorageCdnState.getInstance();
  await reconcileCdnConfiguration({
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

/**
 * Boot failures reject so the process exits before SERVING and the next start
 * retries. Runtime failures are logged so the rest of onConfig still runs.
 */
export async function runCdnReconciliation(
  reconcile: () => Promise<void>,
  failOnError: boolean,
): Promise<void> {
  try {
    await reconcile();
  } catch (error) {
    if (failOnError) throw error;
    ConduitGrpcSdk.Logger?.error(
      `CDN reconciliation failed, it will be retried on the next config update or restart: ${(error as Error).message}`,
    );
  }
}
