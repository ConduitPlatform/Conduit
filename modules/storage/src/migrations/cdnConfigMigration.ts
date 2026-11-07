import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { File, _StorageCdnState } from '../models/index.js';
import { replaceUrlHost } from '../utils/index.js';

export type CdnConfiguration = Record<string, string>;

export const CDN_RECONCILIATION_LOCK = 'storage:cdn-reconciliation';
export const CDN_RECONCILIATION_LOCK_TTL_MS = 10_000;
export const CDN_RECONCILIATION_BATCH_SIZE = 200;
const MAX_CONFIG_RETARGETS = 3;

export type CdnReconciliationStatus = 'pending' | 'complete';

export type CdnStateRecord = {
  container: string;
  status: string;
  appliedHost?: string;
  targetHost?: string;
  checkpointId?: string;
  fence: number;
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
  createState: (doc: CdnStateRecord) => Promise<CdnStateRecord>;
  updateState: (
    filter: { container: string; fence: number },
    patch: Partial<CdnStateRecord>,
  ) => Promise<CdnStateRecord | null>;
  findFiles: (query: Indexable, options: CdnFileQueryOptions) => Promise<CdnFileRecord[]>;
  updateFileUrl: (id: string, url: string) => Promise<unknown>;
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

export function normalizedCdnHost(
  config: CdnConfiguration | undefined,
  container: string,
): string {
  const value = config?.[container];
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

function assertStatus(status: string): CdnReconciliationStatus {
  if (status === 'pending' || status === 'complete') return status;
  throw new Error(`Unexpected CDN reconciliation status ${status}`);
}

function isApplied(
  status: CdnReconciliationStatus,
  appliedHost: string | undefined,
  desired: string,
): boolean {
  switch (status) {
    case 'complete':
      return typeof appliedHost === 'string' && appliedHost === desired;
    case 'pending':
      return false;
    default: {
      const unexpected: never = status;
      throw new Error(`Unexpected CDN reconciliation status ${String(unexpected)}`);
    }
  }
}

function resumeCheckpoint(
  status: CdnReconciliationStatus,
  targetHost: string | undefined,
  checkpointId: string | undefined,
  desired: string,
): string {
  switch (status) {
    case 'pending':
      return targetHost === desired ? checkpointId || '' : '';
    case 'complete':
      return '';
    default: {
      const unexpected: never = status;
      throw new Error(`Unexpected CDN reconciliation status ${String(unexpected)}`);
    }
  }
}

function throwIfLeaseLost(signal: AbortSignal) {
  if (signal.aborted) {
    throw new Error('CDN reconciliation lease expired');
  }
}

async function commitState(
  deps: CdnReconciliationDeps,
  container: string,
  fence: number,
  patch: Partial<CdnStateRecord>,
): Promise<void> {
  const updated = await deps.updateState({ container, fence }, patch);
  if (!updated) {
    throw new Error(
      `CDN reconciliation fence rejected an update for container ${container}`,
    );
  }
}

async function claimContainer(
  deps: CdnReconciliationDeps,
  signal: AbortSignal,
  container: string,
  desired: string,
): Promise<
  { done: true } | { done: false; fence: number; afterId: string; target: string }
> {
  throwIfLeaseLost(signal);
  const existing = await deps.findState(container);
  throwIfLeaseLost(signal);
  if (existing) {
    const status = assertStatus(existing.status);
    if (isApplied(status, existing.appliedHost, desired)) {
      const live = normalizedCdnHost(deps.readConfig(), container);
      if (live === desired) return { done: true };
      desired = live;
    }
    const checkpoint = resumeCheckpoint(
      assertStatus(existing.status),
      existing.targetHost,
      existing.checkpointId,
      desired,
    );
    const fence = existing.fence + 1;
    await commitState(deps, container, existing.fence, {
      status: 'pending',
      targetHost: desired,
      checkpointId: checkpoint,
      fence,
    });
    throwIfLeaseLost(signal);
    return { done: false, fence, afterId: checkpoint, target: desired };
  }

  await deps.createState({
    container,
    status: 'pending',
    targetHost: desired,
    checkpointId: '',
    fence: 1,
  });
  throwIfLeaseLost(signal);
  return { done: false, fence: 1, afterId: '', target: desired };
}

async function reconcileContainer(
  deps: CdnReconciliationDeps,
  signal: AbortSignal,
  container: string,
): Promise<void> {
  const claim = await claimContainer(
    deps,
    signal,
    container,
    normalizedCdnHost(deps.readConfig(), container),
  );
  if (claim.done) return;

  const batchSize = deps.batchSize ?? CDN_RECONCILIATION_BATCH_SIZE;
  const fence = claim.fence;
  let desired = claim.target;
  let afterId = claim.afterId;
  let retargets = 0;
  let updated = 0;
  ConduitGrpcSdk.Logger?.log(`Reconciling CDN urls for container "${container}"`);

  for (;;) {
    throwIfLeaseLost(signal);
    const live = normalizedCdnHost(deps.readConfig(), container);
    if (live !== desired) {
      retargets += 1;
      if (retargets > MAX_CONFIG_RETARGETS) {
        throw new Error(
          `CDN configuration for container ${container} changed during reconciliation`,
        );
      }
      await commitState(deps, container, fence, {
        status: 'pending',
        targetHost: live,
        checkpointId: '',
      });
      desired = live;
      afterId = '';
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

    for (const file of files) {
      throwIfLeaseLost(signal);
      const sourceUrl = file.sourceUrl;
      if (!sourceUrl) {
        throw new Error(`CDN reconciliation missing sourceUrl on file ${file._id}`);
      }
      let nextUrl: string;
      try {
        nextUrl = reconciledFileUrl(sourceUrl, desired);
      } catch {
        throw new Error(`CDN reconciliation cannot use sourceUrl for file ${file._id}`);
      }
      if (nextUrl !== file.url) {
        await deps.updateFileUrl(file._id, nextUrl);
        updated += 1;
        throwIfLeaseLost(signal);
      }
    }

    if (files.length < batchSize) {
      await commitState(deps, container, fence, {
        status: 'complete',
        appliedHost: desired,
        targetHost: '',
        checkpointId: '',
      });
      throwIfLeaseLost(signal);
      ConduitGrpcSdk.Logger?.log(
        `CDN reconciliation completed for container "${container}" (${updated} url update(s))`,
      );
      return;
    }

    afterId = files[files.length - 1]!._id;
    await commitState(deps, container, fence, {
      status: 'pending',
      targetHost: desired,
      checkpointId: afterId,
    });
    throwIfLeaseLost(signal);
  }
}

async function reconcileUnderLock(
  deps: CdnReconciliationDeps,
  signal: AbortSignal,
): Promise<void> {
  throwIfLeaseLost(signal);
  const states = await deps.loadStates();
  throwIfLeaseLost(signal);
  const containers = reconciliationContainers(deps.readConfig(), states);
  for (const container of containers) {
    await reconcileContainer(deps, signal, container);
  }
}

export async function reconcileCdnConfiguration(
  deps: CdnReconciliationDeps,
): Promise<void> {
  try {
    await deps.usingLock(
      CDN_RECONCILIATION_LOCK,
      CDN_RECONCILIATION_LOCK_TTL_MS,
      async signal => {
        await reconcileUnderLock(deps, signal);
      },
    );
  } catch (error) {
    ConduitGrpcSdk.Logger?.error(
      `CDN reconciliation failed: ${(error as Error).message}`,
    );
    throw error;
  }
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
    updateState: (filter, patch) => states.updateOne(filter, patch),
    findFiles: (query, options) => files.findMany(query, options),
    updateFileUrl: (id, url) => files.findByIdAndUpdate(id, { url }),
    usingLock: (resource, ttl, fn) => grpcSdk.state!.usingLock(resource, ttl, fn),
  });
}
