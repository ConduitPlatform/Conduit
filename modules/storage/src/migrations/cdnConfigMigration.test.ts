import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigController } from '@conduitplatform/module-tools';
import { File, _StorageContainer, _StorageCdnState } from '../models/index.js';
import { migrateFileUriReferences } from './fileUriMigration.js';
import {
  type CdnConfiguration,
  type CdnReconciliationDeps,
  type CdnStateRecord,
  CDN_RECONCILIATION_BATCH_SIZE,
  CDN_RECONCILIATION_LOCK,
  cdnStateFenceFilter,
  fileUrlPredicate,
  publicFilesWithProviderSourceQuery,
  reconcileCdnConfiguration,
  reconciledFileUrl,
  reconcileStoredCdnConfig,
} from './cdnConfigMigration.js';

const SOURCE =
  'https://account.blob.core.windows.net/media/object?se=2125-01-01T00:00:00Z&sig=keep';
const CDN_HOST = 'cdn.example.test';
const CDN_URL = reconciledFileUrl(SOURCE, CDN_HOST);

type StoredFile = {
  _id: string;
  container: string;
  isPublic: boolean;
  url?: string;
  sourceUrl?: string;
  uri?: string;
};

function matchesSourceClause(
  file: StoredFile,
  clause: { sourceUrl?: Record<string, unknown> },
) {
  const cond = clause.sourceUrl;
  if (!cond) return true;
  if (cond.$exists === true && !Object.prototype.hasOwnProperty.call(file, 'sourceUrl')) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(cond, '$ne') && file.sourceUrl === cond.$ne) {
    return false;
  }
  return true;
}

function pageFiles(files: StoredFile[], query: Record<string, unknown>, limit: number) {
  const afterId = (query._id as { $gt?: string } | undefined)?.$gt;
  const clauses =
    (query.$and as Array<{ sourceUrl?: Record<string, unknown> }> | undefined) ?? [];
  return files
    .filter(file => {
      if (query.container !== undefined && file.container !== query.container)
        return false;
      if (query.isPublic !== undefined && file.isPublic !== query.isPublic) return false;
      if (afterId !== undefined && !(file._id > afterId)) return false;
      return clauses.every(clause => matchesSourceClause(file, clause));
    })
    .sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0))
    .slice(0, limit);
}

function memoryState(initial: CdnStateRecord[] = []) {
  const docs = initial.map(doc => ({ ...doc }));
  return {
    docs,
    async loadStates() {
      return docs.map(doc => ({ ...doc }));
    },
    async findState(container: string) {
      const found = docs.find(doc => doc.container === container);
      return found ? { ...found } : null;
    },
    async createState(doc: CdnStateRecord) {
      if (docs.some(existing => existing.container === doc.container)) {
        throw new Error('duplicate cdn state');
      }
      docs.push({ ...doc });
      return { ...doc };
    },
    async updateState(
      filter: { container: string; fence: number },
      patch: Partial<CdnStateRecord>,
    ) {
      const found = docs.find(
        doc => doc.container === filter.container && doc.fence === filter.fence,
      );
      if (!found) return null;
      Object.assign(found, patch);
      return { ...found };
    },
  };
}

function openLock(): CdnReconciliationDeps['usingLock'] {
  return async (_resource, _ttl, fn) => fn(new AbortController().signal);
}

function harness(options: {
  files: StoredFile[];
  config: CdnConfiguration;
  states?: CdnStateRecord[];
  batchSize?: number;
  usingLock?: CdnReconciliationDeps['usingLock'];
  onFindFiles?: (query: Record<string, unknown>) => void;
  onUpdateFile?: (id: string, url: string) => void;
  updateState?: CdnReconciliationDeps['updateState'];
}) {
  const state = memoryState(options.states);
  const queries: Array<Record<string, unknown>> = [];
  const fileWrites: Array<{ id: string; url: string }> = [];
  const deps: CdnReconciliationDeps = {
    readConfig: () => options.config,
    loadStates: () => state.loadStates(),
    findState: container => state.findState(container),
    createState: doc => state.createState(doc),
    updateState:
      options.updateState ?? ((filter, patch) => state.updateState(filter, patch)),
    findFiles: async (query, findOptions) => {
      queries.push(query);
      options.onFindFiles?.(query);
      return pageFiles(options.files, query, findOptions.limit);
    },
    updateFileUrl: async (id, observedUrl, nextUrl, container, fence) => {
      options.onUpdateFile?.(id, nextUrl);
      const file = options.files.find(candidate => candidate._id === id);
      if (!file) throw new Error(`missing file ${id}`);
      const current = await deps.findState(container);
      if (!current || current.fence !== fence) return null;
      if ((file.url ?? null) !== observedUrl) return null;
      if (observedUrl === nextUrl) {
        throw new Error(`unchanged file row was written: ${id}`);
      }
      fileWrites.push({ id, url: nextUrl });
      file.url = nextUrl;
      return { _id: id, url: nextUrl };
    },
    usingLock: options.usingLock ?? openLock(),
    batchSize: options.batchSize,
  };
  return { deps, state, queries, fileWrites, files: options.files };
}

describe('reconciledFileUrl', () => {
  it('replaces only the authority and restores the provider source on host removal', () => {
    const source =
      'https://account.blob.core.windows.net/media/object?se=2125-01-01T00:00:00Z&sig=keep&echo=account.blob.core.windows.net';
    const rewritten = reconciledFileUrl(source, 'cdn.example.test');
    assert.equal(
      rewritten,
      'https://cdn.example.test/media/object?se=2125-01-01T00:00:00Z&sig=keep&echo=account.blob.core.windows.net',
    );
    assert.equal(reconciledFileUrl(source, ''), source);
  });
});

describe('publicFilesWithProviderSourceQuery', () => {
  it('selects public files in one container that have a provider source and can resume', () => {
    const query = publicFilesWithProviderSourceQuery('media', 'file-01');
    assert.equal(query.container, 'media');
    assert.equal(query.isPublic, true);
    assert.deepEqual(query._id, { $gt: 'file-01' });
    assert.deepEqual(query.$and, [
      { sourceUrl: { $exists: true } },
      { sourceUrl: { $ne: null } },
      { sourceUrl: { $ne: '' } },
    ]);
  });
});

describe('reconcileCdnConfiguration', () => {
  it('does not scan or write when the persisted host is already applied', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: CDN_URL,
        },
      ],
      states: [
        {
          container: 'media',
          status: 'complete',
          appliedHost: CDN_HOST,
          targetHost: '',
          checkpointId: '',
          fence: 4,
        },
      ],
    });
    env.deps.findFiles = async () => {
      throw new Error('completed config must not scan files');
    };

    await reconcileCdnConfiguration(env.deps);

    assert.equal(env.fileWrites.length, 0);
    assert.equal(env.state.docs[0]!.fence, 4);
    assert.equal(env.state.docs[0]!.status, 'complete');
  });

  it('reconciles a container with no prior state and writes only changed urls', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-01',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: CDN_URL,
        },
      ],
    });

    await reconcileCdnConfiguration(env.deps);

    assert.deepEqual(env.fileWrites, [{ id: 'file-00', url: CDN_URL }]);
    assert.equal(env.files[1]!.url, CDN_URL);
    assert.equal(env.files[0]!.sourceUrl, SOURCE);
    assert.equal(env.state.docs[0]!.status, 'complete');
    assert.equal(env.state.docs[0]!.appliedHost, CDN_HOST);
    assert.equal(env.state.docs[0]!.checkpointId, '');
  });

  it('does not write file rows whose url is already correct, including the first run', async () => {
    let writes = 0;
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: CDN_URL,
        },
      ],
      onUpdateFile: () => {
        writes += 1;
      },
    });

    await reconcileCdnConfiguration(env.deps);

    assert.equal(writes, 0);
    assert.equal(env.fileWrites.length, 0);
    assert.equal(env.files[0]!.url, CDN_URL);
    assert.equal(env.files[0]!.sourceUrl, SOURCE);
    assert.equal(env.state.docs[0]!.status, 'complete');
    assert.equal(env.state.docs[0]!.appliedHost, CDN_HOST);
  });

  it('pages by _id and resumes after the last successful page', async () => {
    const files: StoredFile[] = Array.from({ length: 5 }, (_, index) => ({
      _id: `file-0${index}`,
      container: 'media',
      isPublic: true,
      sourceUrl: SOURCE,
      url: SOURCE,
    }));
    let scans = 0;
    const env = harness({
      config: { media: CDN_HOST },
      files,
      batchSize: 2,
      onFindFiles: () => {
        scans += 1;
        if (scans === 2) throw new Error('crash');
      },
    });

    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /crash/);
    assert.equal(env.state.docs[0]!.status, 'pending');
    assert.equal(env.state.docs[0]!.checkpointId, 'file-01');
    assert.equal(env.state.docs[0]!.appliedHost, undefined);
    assert.deepEqual(
      env.fileWrites.map(write => write.id),
      ['file-00', 'file-01'],
    );

    const resumedWrites: string[] = [];
    env.deps.findFiles = async (query, findOptions) => {
      env.queries.push(query);
      return pageFiles(files, query, findOptions.limit);
    };
    env.deps.updateFileUrl = async (id, _observedUrl, url) => {
      resumedWrites.push(id);
      const file = files.find(candidate => candidate._id === id);
      file!.url = url;
      return { _id: id, url };
    };

    await reconcileCdnConfiguration(env.deps);

    assert.deepEqual(resumedWrites, ['file-02', 'file-03', 'file-04']);
    assert.equal(env.state.docs[0]!.status, 'complete');
    assert.equal(env.state.docs[0]!.appliedHost, CDN_HOST);
    assert.ok(
      env.queries.some(
        query => (query._id as { $gt?: string } | undefined)?.$gt === 'file-01',
      ),
    );
  });

  it('does not advance the checkpoint or record completion when a page fails', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      batchSize: 2,
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-01',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
      ],
      onUpdateFile: id => {
        if (id === 'file-01') throw new Error('write failed');
      },
    });

    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /write failed/);

    assert.equal(env.state.docs[0]!.status, 'pending');
    assert.equal(env.state.docs[0]!.checkpointId, '');
    assert.equal(env.state.docs[0]!.appliedHost, undefined);
    assert.equal(env.files[0]!.url, CDN_URL);
    assert.equal(env.files[1]!.url, SOURCE);
  });

  it('changes and removes hosts from the provider source without rewriting equal rows', async () => {
    const nextHost = 'cdn.other.test';
    const env = harness({
      config: { media: nextHost },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: 'https://cdn.example.test/media/renamed?se=1999-01-01T00:00:00Z&sig=old',
        },
      ],
      states: [
        {
          container: 'media',
          status: 'complete',
          appliedHost: CDN_HOST,
          checkpointId: '',
          fence: 2,
        },
      ],
    });

    await reconcileCdnConfiguration(env.deps);

    assert.equal(env.fileWrites[0]!.url, reconciledFileUrl(SOURCE, nextHost));
    assert.equal(env.files[0]!.sourceUrl, SOURCE);
    assert.equal(env.state.docs[0]!.appliedHost, nextHost);

    env.deps.readConfig = () => ({});
    await reconcileCdnConfiguration(env.deps);

    assert.equal(env.files[0]!.url, SOURCE);
    assert.equal(env.files[0]!.sourceUrl, SOURCE);
    assert.equal(env.state.docs[0]!.appliedHost, '');
    assert.equal(env.state.docs[0]!.status, 'complete');

    const queriesAfterRemoval = env.queries.length;
    const writesAfterRemoval = env.fileWrites.length;
    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.queries.length, queriesAfterRemoval);
    assert.equal(env.fileWrites.length, writesAfterRemoval);
  });

  it('ignores private files, other containers, and public files without a provider source', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-01',
          container: 'media',
          isPublic: false,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-02',
          container: 'archive',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-03',
          container: 'media',
          isPublic: true,
          sourceUrl: '',
          url: CDN_URL,
        },
        { _id: 'file-04', container: 'media', isPublic: true, url: CDN_URL },
      ],
    });

    await reconcileCdnConfiguration(env.deps);

    assert.deepEqual(
      env.fileWrites.map(write => write.id),
      ['file-00'],
    );
    assert.equal(env.files[1]!.url, SOURCE);
    assert.equal(env.files[2]!.url, SOURCE);
    assert.equal(env.files[3]!.url, CDN_URL);
    assert.equal(env.files[4]!.url, CDN_URL);
    assert.equal(env.queries[0]!.container, 'media');
    assert.equal(env.queries[0]!.isPublic, true);
    assert.equal(env.state.docs[0]!.status, 'complete');
  });

  it('fails the page when a configured host cannot be applied to sourceUrl', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: 'not a url',
          url: CDN_URL,
        },
      ],
    });

    await assert.rejects(
      () => reconcileCdnConfiguration(env.deps),
      /cannot use sourceUrl for file file-00/,
    );
    assert.equal(env.files[0]!.url, CDN_URL);
    assert.equal(env.files[0]!.sourceUrl, 'not a url');
    assert.equal(env.state.docs[0]!.status, 'pending');
    assert.notEqual(env.state.docs[0]!.status, 'complete');
    assert.equal(env.state.docs[0]!.appliedHost, undefined);
  });

  it('does not checkpoint after lease loss and does not undo a file write that already landed', async () => {
    const controller = new AbortController();
    const env = harness({
      config: { media: CDN_HOST },
      batchSize: 2,
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-01',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
      ],
      usingLock: async (_resource, _ttl, fn) => fn(controller.signal),
      onUpdateFile: () => {
        controller.abort();
      },
    });

    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /lease expired/);
    assert.equal(env.state.docs[0]!.checkpointId, '');
    assert.equal(env.state.docs[0]!.status, 'pending');
    assert.equal(env.state.docs[0]!.appliedHost, undefined);
    assert.equal(env.files[0]!.url, CDN_URL);
    assert.equal(env.files[1]!.url, SOURCE);
  });

  it('rejects a stale fence and does not record completion', async () => {
    const state = memoryState();
    const env = harness({
      config: { media: CDN_HOST },
      batchSize: 2,
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-01',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
      ],
      updateState: async (filter, patch) => {
        if (patch.checkpointId || patch.status === 'complete') return null;
        return state.updateState(filter, patch);
      },
    });
    env.deps.createState = doc => state.createState(doc);
    env.deps.findState = container => state.findState(container);
    env.deps.loadStates = () => state.loadStates();

    await assert.rejects(
      () => reconcileCdnConfiguration(env.deps),
      /fence rejected an update for container media/,
    );
    assert.equal(state.docs[0]!.status, 'pending');
    assert.equal(state.docs[0]!.appliedHost, undefined);
    assert.equal(state.docs[0]!.checkpointId, '');
  });

  it('serializes replicas and lets the follower skip a completed container', async () => {
    const files: StoredFile[] = [
      {
        _id: 'file-00',
        container: 'media',
        isPublic: true,
        sourceUrl: SOURCE,
        url: SOURCE,
      },
    ];
    const state = memoryState();
    let chain: Promise<unknown> = Promise.resolve();
    const usingLock: CdnReconciliationDeps['usingLock'] = (_resource, ttl, fn) => {
      assert.equal(_resource, CDN_RECONCILIATION_LOCK);
      assert.equal(ttl > 0, true);
      const run = chain.then(() => fn(new AbortController().signal));
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    };
    const first = harness({ config: { media: CDN_HOST }, files, usingLock });
    const second = harness({ config: { media: CDN_HOST }, files, usingLock });
    first.deps.loadStates = () => state.loadStates();
    first.deps.findState = container => state.findState(container);
    first.deps.createState = doc => state.createState(doc);
    first.deps.updateState = (filter, patch) => state.updateState(filter, patch);
    second.deps.loadStates = () => state.loadStates();
    second.deps.findState = container => state.findState(container);
    second.deps.createState = doc => state.createState(doc);
    second.deps.updateState = (filter, patch) => state.updateState(filter, patch);
    let secondScans = 0;
    second.deps.findFiles = async () => {
      secondScans += 1;
      return [];
    };

    await Promise.all([
      reconcileCdnConfiguration(first.deps),
      reconcileCdnConfiguration(second.deps),
    ]);

    assert.equal(secondScans, 0);
    assert.equal(files[0]!.url, CDN_URL);
    assert.equal(state.docs[0]!.status, 'complete');
  });

  it('does not scan when another replica holds the lock', async () => {
    let scans = 0;
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
      ],
      usingLock: async () => {
        throw new Error('CDN reconciliation lock is held by another replica');
      },
    });
    env.deps.findFiles = async () => {
      scans += 1;
      return [];
    };

    await assert.rejects(
      () => reconcileCdnConfiguration(env.deps),
      /lock is held by another replica/,
    );
    assert.equal(scans, 0);
    assert.equal(env.files[0]!.url, SOURCE);
  });

  it('retargets when config changes and refuses to finish while it keeps changing', async () => {
    const files: StoredFile[] = Array.from({ length: 3 }, (_, index) => ({
      _id: `file-0${index}`,
      container: 'media',
      isPublic: true,
      sourceUrl: SOURCE,
      url: SOURCE,
    }));
    let host = CDN_HOST;
    const env = harness({
      config: { media: host },
      files,
      batchSize: 2,
    });
    env.deps.readConfig = () => ({ media: host });
    env.deps.updateFileUrl = async (id, _observedUrl, url) => {
      if (env.fileWrites.length === 1) host = 'cdn.other.test';
      env.fileWrites.push({ id, url });
      files.find(file => file._id === id)!.url = url;
      return { _id: id, url };
    };

    await reconcileCdnConfiguration(env.deps);

    assert.equal(env.state.docs[0]!.appliedHost, 'cdn.other.test');
    assert.equal(env.state.docs[0]!.status, 'complete');
    for (const file of files) {
      assert.equal(file.url, reconciledFileUrl(SOURCE, 'cdn.other.test'));
      assert.equal(file.sourceUrl, SOURCE);
    }

    let version = 0;
    env.deps.readConfig = () => {
      version += 1;
      return { media: `cdn-${version}.example.test` };
    };
    await assert.rejects(
      () => reconcileCdnConfiguration(env.deps),
      /changed during reconciliation/,
    );
    assert.notEqual(env.state.docs[0]!.status, 'complete');
  });

  it('rejects a delayed A→B write when the newer owner wanted A and skipped the file', async () => {
    const observed = reconciledFileUrl(SOURCE, 'cdn.other.test');
    const staleUrl = reconciledFileUrl(SOURCE, CDN_HOST);
    const files: StoredFile[] = [
      {
        _id: 'file-00',
        container: 'media',
        isPublic: true,
        sourceUrl: SOURCE,
        url: observed,
      },
    ];
    const state = memoryState();
    const events: string[] = [];
    const baseUpdate = state.updateState.bind(state);
    state.updateState = async (filter, patch) => {
      const updated = await baseUpdate(filter, patch);
      if (updated && patch.status === 'complete') events.push('complete');
      return updated;
    };
    let releaseDelayed!: () => void;
    const delayed = new Promise<void>(resolve => {
      releaseDelayed = resolve;
    });
    let notifyStarted!: () => void;
    const started = new Promise<void>(resolve => {
      notifyStarted = resolve;
    });
    const apply = (
      id: string,
      observedUrl: string | null,
      nextUrl: string,
      container: string,
      fence: number,
    ) => {
      const file = files.find(candidate => candidate._id === id)!;
      const current = state.docs.find(doc => doc.container === container);
      if (!current || current.fence !== fence) return null;
      if ((file.url ?? null) !== observedUrl) return null;
      if (observedUrl === nextUrl) throw new Error('unchanged file row was written');
      file.url = nextUrl;
      return { ...file };
    };
    const share = (env: ReturnType<typeof harness>) => {
      env.deps.loadStates = () => state.loadStates();
      env.deps.findState = container => state.findState(container);
      env.deps.createState = doc => state.createState(doc);
      env.deps.updateState = (filter, patch) => state.updateState(filter, patch);
    };
    const older = harness({ config: { media: CDN_HOST }, files });
    share(older);
    let olderFence = 0;
    older.deps.updateFileUrl = async (id, observedUrl, nextUrl, container, fence) => {
      olderFence = fence;
      assert.equal(observedUrl, observed);
      assert.equal(nextUrl, staleUrl);
      notifyStarted();
      await delayed;
      const written = apply(id, observedUrl, nextUrl, container, fence);
      events.push(written ? 'stale-wrote' : 'stale-rejected');
      return written;
    };
    const newer = harness({ config: { media: 'cdn.other.test' }, files });
    share(newer);
    let newerWrites = 0;
    newer.deps.updateFileUrl = async () => {
      newerWrites += 1;
      throw new Error('newer owner wrote a file whose url was already correct');
    };

    const pending = reconcileCdnConfiguration(older.deps);
    await started;
    await reconcileCdnConfiguration(newer.deps);
    assert.deepEqual(events, ['complete']);
    releaseDelayed();

    await assert.rejects(pending, /lost file file-00 to a newer owner/);
    assert.deepEqual(events, ['complete', 'stale-rejected']);
    assert.equal(newerWrites, 0);
    assert.equal(files[0]!.url, observed);
    assert.equal(files[0]!.sourceUrl, SOURCE);
    assert.equal(state.docs[0]!.fence > olderFence, true);
    assert.equal(state.docs[0]!.status, 'complete');
    assert.equal(state.docs[0]!.appliedHost, 'cdn.other.test');
  });

  it('rejects a delayed write after config rolls back to the observed url', async () => {
    const files: StoredFile[] = [
      {
        _id: 'file-00',
        container: 'media',
        isPublic: true,
        sourceUrl: SOURCE,
        url: SOURCE,
      },
    ];
    const state = memoryState();
    let releaseDelayed!: () => void;
    const delayed = new Promise<void>(resolve => {
      releaseDelayed = resolve;
    });
    let notifyStarted!: () => void;
    const started = new Promise<void>(resolve => {
      notifyStarted = resolve;
    });
    const share = (env: ReturnType<typeof harness>) => {
      env.deps.loadStates = () => state.loadStates();
      env.deps.findState = container => state.findState(container);
      env.deps.createState = doc => state.createState(doc);
      env.deps.updateState = (filter, patch) => state.updateState(filter, patch);
    };
    const older = harness({ config: { media: CDN_HOST }, files });
    share(older);
    older.deps.updateFileUrl = async (id, observedUrl, nextUrl, container, fence) => {
      notifyStarted();
      await delayed;
      const file = files.find(candidate => candidate._id === id)!;
      const current = state.docs.find(doc => doc.container === container);
      if (!current || current.fence !== fence) return null;
      if ((file.url ?? null) !== observedUrl) return null;
      file.url = nextUrl;
      return { ...file };
    };
    const newer = harness({ config: { media: '' }, files });
    share(newer);
    let newerWrites = 0;
    newer.deps.updateFileUrl = async () => {
      newerWrites += 1;
      return null;
    };

    const pending = reconcileCdnConfiguration(older.deps);
    await started;
    await reconcileCdnConfiguration(newer.deps);
    releaseDelayed();

    await assert.rejects(pending, /lost file file-00 to a newer owner/);
    assert.equal(newerWrites, 0);
    assert.equal(files[0]!.url, SOURCE);
    assert.equal(files[0]!.sourceUrl, SOURCE);
    assert.equal(state.docs[0]!.status, 'complete');
    assert.equal(state.docs[0]!.appliedHost, '');
  });

  it('does not finish on the previous host when config changes on the final page', async () => {
    const nextHost = 'cdn.other.test';
    let sawPreviousCompletion = false;
    const state = memoryState();
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        {
          _id: 'file-00',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
      ],
      updateState: async (filter, patch) => {
        const updated = await state.updateState(filter, patch);
        if (patch.status === 'complete' && patch.appliedHost === CDN_HOST) {
          sawPreviousCompletion = true;
        }
        return updated;
      },
    });
    env.deps.loadStates = () => state.loadStates();
    env.deps.findState = container => state.findState(container);
    env.deps.createState = doc => state.createState(doc);
    env.deps.readConfig = () => ({
      media: sawPreviousCompletion ? nextHost : CDN_HOST,
    });

    await reconcileCdnConfiguration(env.deps);

    assert.equal(sawPreviousCompletion, true);
    assert.equal(state.docs[0]!.status, 'complete');
    assert.equal(state.docs[0]!.appliedHost, nextHost);
    assert.equal(env.files[0]!.url, reconciledFileUrl(SOURCE, nextHost));
    assert.equal(env.files[0]!.sourceUrl, SOURCE);
  });

  it('reconciles a container added while another container is in progress', async () => {
    const config: CdnConfiguration = { media: CDN_HOST };
    const env = harness({
      config,
      files: [
        {
          _id: 'file-media',
          container: 'media',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
        {
          _id: 'file-archive',
          container: 'archive',
          isPublic: true,
          sourceUrl: SOURCE,
          url: SOURCE,
        },
      ],
    });
    env.deps.readConfig = () => config;
    env.deps.updateFileUrl = async (id, observedUrl, url, container, fence) => {
      if (id === 'file-media') config.archive = 'cdn.other.test';
      const file = env.files.find(candidate => candidate._id === id)!;
      const current = env.state.docs.find(doc => doc.container === container);
      if (!current || current.fence !== fence) return null;
      if ((file.url ?? null) !== observedUrl) return null;
      env.fileWrites.push({ id, url });
      file.url = url;
      return file;
    };

    await reconcileCdnConfiguration(env.deps);

    const media = env.state.docs.find(doc => doc.container === 'media');
    const archive = env.state.docs.find(doc => doc.container === 'archive');
    assert.equal(media?.status, 'complete');
    assert.equal(media?.appliedHost, CDN_HOST);
    assert.equal(archive?.status, 'complete');
    assert.equal(archive?.appliedHost, 'cdn.other.test');
    assert.equal(
      env.files.find(file => file._id === 'file-archive')!.url,
      reconciledFileUrl(SOURCE, 'cdn.other.test'),
    );
  });

  it('runs URI migration before CDN reconciliation and leaves cleared sources untouched', async () => {
    const files: StoredFile[] = [
      {
        _id: 'file-public',
        container: 'media',
        isPublic: true,
        sourceUrl: SOURCE,
        url: SOURCE,
      },
      {
        _id: 'file-private-container',
        container: 'archive',
        isPublic: true,
        sourceUrl: SOURCE,
        url: CDN_URL,
      },
    ];
    const originalFileGetInstance = File.getInstance.bind(File);
    const originalContainerGetInstance =
      _StorageContainer.getInstance.bind(_StorageContainer);
    File.getInstance = (() => ({
      findMany: async (query: Record<string, unknown>, options: { limit?: number }) => {
        const afterId = (query._id as { $gt?: string } | undefined)?.$gt;
        const remaining = files.filter(file => {
          if (query.isPublic === true && file.isPublic !== true) return false;
          if (afterId && !(file._id > afterId)) return false;
          const missingUri =
            !Object.prototype.hasOwnProperty.call(file, 'uri') ||
            file.uri === '' ||
            file.uri == null;
          return missingUri;
        });
        return remaining.slice(0, options.limit);
      },
      findByIdAndUpdate: async (id: string, update: Record<string, string>) => {
        const file = files.find(candidate => candidate._id === id)!;
        Object.assign(file, update);
        return file;
      },
    })) as unknown as typeof File.getInstance;
    _StorageContainer.getInstance = (() => ({
      findMany: async () => [
        { _id: 'c1', name: 'media', isPublic: true },
        { _id: 'c2', name: 'archive', isPublic: false },
      ],
    })) as unknown as typeof _StorageContainer.getInstance;

    try {
      await migrateFileUriReferences();
      const env = harness({
        config: { media: CDN_HOST, archive: CDN_HOST },
        files,
      });
      await reconcileCdnConfiguration(env.deps);

      assert.equal(files[0]!.uri, '/storage/getFileUrl/file-public');
      assert.equal(files[0]!.sourceUrl, SOURCE);
      assert.equal(files[0]!.url, CDN_URL);
      assert.equal(files[1]!.sourceUrl, '');
      assert.equal(files[1]!.url, '');
      assert.equal(
        env.fileWrites.some(write => write.id === 'file-private-container'),
        false,
      );
      const archive = env.state.docs.find(doc => doc.container === 'archive');
      assert.equal(archive?.status, 'complete');
      assert.equal(archive?.appliedHost, CDN_HOST);
    } finally {
      File.getInstance = originalFileGetInstance;
      _StorageContainer.getInstance = originalContainerGetInstance;
    }
  });
});

describe('reconcileStoredCdnConfig', () => {
  const originalFileGetInstance = File.getInstance.bind(File);
  const originalStateGetInstance = _StorageCdnState.getInstance.bind(_StorageCdnState);

  afterEach(() => {
    File.getInstance = originalFileGetInstance;
    _StorageCdnState.getInstance = originalStateGetInstance;
  });

  it('writes only the computed url through the file model', async () => {
    const updates: Array<{
      filter: Record<string, unknown>;
      patch: Record<string, unknown>;
      options?: Record<string, unknown>;
    }> = [];
    let fileQuery:
      { query: Record<string, unknown>; options: Record<string, unknown> } | undefined;
    const states: CdnStateRecord[] = [];
    File.getInstance = (() => ({
      findMany: async (
        query: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => {
        fileQuery = { query, options };
        return [{ _id: 'file-00', url: SOURCE, sourceUrl: SOURCE }];
      },
      updateOne: async (
        filter: Record<string, unknown>,
        patch: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        updates.push({ filter, patch, options });
        return { _id: 'file-00', ...patch };
      },
    })) as unknown as typeof File.getInstance;
    _StorageCdnState.getInstance = (() => ({
      findMany: async () => states.map(doc => ({ ...doc })),
      findOne: async (query: { container: string }) => {
        const found = states.find(doc => doc.container === query.container);
        return found ? { ...found } : null;
      },
      create: async (doc: CdnStateRecord) => {
        states.push({ ...doc });
        return { ...doc };
      },
      updateOne: async (
        filter: { container: string; fence: number },
        patch: Partial<CdnStateRecord>,
      ) => {
        const found = states.find(
          doc => doc.container === filter.container && doc.fence === filter.fence,
        );
        if (!found) return null;
        Object.assign(found, patch);
        return { ...found };
      },
    })) as unknown as typeof _StorageCdnState.getInstance;

    const previous = ConfigController.getInstance().config;
    ConfigController.getInstance().config = {
      ...previous,
      cdnConfiguration: { media: CDN_HOST },
    };
    try {
      await reconcileStoredCdnConfig({
        state: {
          usingLock: async (
            _resource: string,
            _ttl: number,
            fn: (signal: AbortSignal) => Promise<unknown>,
          ) => fn(new AbortController().signal),
        },
      } as unknown as Parameters<typeof reconcileStoredCdnConfig>[0]);
    } finally {
      ConfigController.getInstance().config = previous;
    }

    assert.deepEqual(updates, [
      {
        filter: fileUrlPredicate('file-00', SOURCE),
        patch: { url: CDN_URL },
        options: {
          guardSchema: '_StorageCdnState',
          guardFilter: cdnStateFenceFilter('media', 1),
        },
      },
    ]);
    assert.deepEqual(fileQuery?.options, {
      skip: 0,
      limit: CDN_RECONCILIATION_BATCH_SIZE,
      sort: { _id: 1 },
      select: '_id url sourceUrl',
      readPreference: 'primary',
    });
    assert.equal(fileQuery?.query.container, 'media');
    assert.equal(fileQuery?.query.isPublic, true);
    assert.equal(states[0]!.status, 'complete');
    assert.equal(states[0]!.appliedHost, CDN_HOST);
  });

  it('fails before scanning when state locks are unavailable', async () => {
    let scanned = false;
    File.getInstance = (() => ({
      findMany: async () => {
        scanned = true;
        return [];
      },
    })) as unknown as typeof File.getInstance;

    await assert.rejects(
      () =>
        reconcileStoredCdnConfig({} as Parameters<typeof reconcileStoredCdnConfig>[0]),
      /requires state locks/,
    );
    assert.equal(scanned, false);
  });
});

describe('cdn state schema', () => {
  it('requires one unique container field for the persisted host', () => {
    const model = _StorageCdnState.getInstance({} as never);
    try {
      const container = model.fields.container as {
        unique?: boolean;
        required?: boolean;
      };
      assert.equal(container.required, true);
      assert.equal(container.unique, true);
    } finally {
      (_StorageCdnState as unknown as { _instance?: unknown })._instance = undefined;
    }
  });
});
