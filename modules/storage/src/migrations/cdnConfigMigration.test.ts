import { afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ConduitGrpcSdk, type IConduitLogger } from '@conduitplatform/grpc-sdk';
import { File, _StorageContainer, _StorageCdnState } from '../models/index.js';
import { replaceUrlHost } from '../utils/index.js';
import { migrateFileUriReferences } from './fileUriMigration.js';
import {
  type CdnConfiguration,
  type CdnReconciliationDeps,
  type CdnStateRecord,
  CDN_RECONCILIATION_LOCK,
  publicFilesWithProviderSourceQuery,
  reconcileCdnConfiguration,
  reconciledFileUrl,
  reconcileStoredCdnConfig,
  CdnReconciliationRunner,
  changedCdnContainers,
  CDN_WRITE_CONCURRENCY,
} from './cdnConfigMigration.js';

// Redlock is a dependency of grpc-sdk only, so load the same classes from there.
const redlock = createRequire(
  createRequire(import.meta.url).resolve('@conduitplatform/grpc-sdk'),
)('@sesamecare-oss/redlock');

/** Redlock wraps whatever each Redis node answered into an ExecutionError. */
function executionError(...votes: Error[]): Error {
  const attempt = Promise.resolve({
    membershipSize: votes.length,
    quorumSize: 1,
    votesFor: new Set(),
    votesAgainst: new Map(votes.map((vote, i) => [`node-${i}`, vote])),
  });
  return new redlock.ExecutionError(
    'The operation was unable to achieve a quorum during its retry window.',
    [attempt],
  );
}

const SOURCE =
  'https://account.blob.core.windows.net/media/object?se=2125-01-01T00:00:00Z&sig=keep';
const CDN_HOST = 'cdn.example.test';
const OTHER_HOST = 'cdn.other.test';
const CDN_URL = reconciledFileUrl(SOURCE, CDN_HOST);

const warnings: string[] = [];
const errors: string[] = [];
const logs: string[] = [];

before(() => {
  const logger = {
    log: (m: string) => void logs.push(m),
    warn: (m: string) => void warnings.push(m),
    error: (m: string | Error) => void errors.push(String(m)),
  } as unknown as IConduitLogger;
  new ConduitGrpcSdk('127.0.0.1:55152', 'cdn-test', false, logger);
});

beforeEach(() => {
  warnings.length = 0;
  errors.length = 0;
  logs.length = 0;
});

type StoredFile = {
  _id: string;
  container: string;
  isPublic: boolean;
  url?: string;
  sourceUrl?: string;
  uri?: string;
};

function file(id: string, overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    _id: id,
    container: 'media',
    isPublic: true,
    sourceUrl: SOURCE,
    url: SOURCE,
    ...overrides,
  };
}

/** In-memory equivalent of publicFilesWithProviderSourceQuery. */
function pageFiles(files: StoredFile[], query: Record<string, any>, limit: number) {
  const afterId = query._id?.$gt as string | undefined;
  return files
    .filter(
      f =>
        f.container === query.container &&
        f.isPublic === query.isPublic &&
        (afterId === undefined || f._id > afterId) &&
        !!f.sourceUrl,
    )
    .sort((a, b) => (a._id < b._id ? -1 : 1))
    .slice(0, limit);
}

function harness(options: {
  files: StoredFile[];
  config: CdnConfiguration;
  states?: CdnStateRecord[];
  batchSize?: number;
  usingLock?: CdnReconciliationDeps['usingLock'];
}) {
  const docs = (options.states ?? []).map(doc => ({ ...doc }));
  const queries: Array<Record<string, any>> = [];
  const fileWrites: Array<{ id: string; url: string }> = [];
  const deps: CdnReconciliationDeps = {
    readConfig: () => options.config,
    loadStates: async () => docs.map(doc => ({ ...doc })),
    findState: async container => {
      const found = docs.find(doc => doc.container === container);
      return found ? { ...found } : null;
    },
    createState: async doc => void docs.push({ ...doc }),
    updateState: async (container, patch) => {
      Object.assign(
        docs.find(doc => doc.container === container)!,
        patch,
      );
    },
    findFiles: async (query, findOptions) => {
      queries.push(query);
      return pageFiles(options.files, query, findOptions.limit);
    },
    // Conditional write, like File.updateOne({ _id, url: observed }, { url }).
    updateFileUrl: async (id, observedUrl, nextUrl) => {
      const stored = options.files.find(candidate => candidate._id === id)!;
      if ((stored.url ?? null) !== observedUrl) return false;
      if (observedUrl === nextUrl) throw new Error(`unchanged row was written: ${id}`);
      stored.url = nextUrl;
      fileWrites.push({ id, url: nextUrl });
      return true;
    },
    usingLock:
      options.usingLock ?? ((_resource, _ttl, fn) => fn(new AbortController().signal)),
    batchSize: options.batchSize,
  };
  return { deps, docs, queries, fileWrites, files: options.files };
}

const completeState = (appliedHost: string): CdnStateRecord => ({
  container: 'media',
  status: 'complete',
  appliedHost,
  targetHost: '',
  checkpointId: '',
});

describe('reconciledFileUrl', () => {
  it('replaces only the authority and restores the provider source on host removal', () => {
    const source =
      'https://account.blob.core.windows.net/media/object?se=2125-01-01T00:00:00Z&sig=keep&echo=account.blob.core.windows.net';
    assert.equal(
      reconciledFileUrl(source, CDN_HOST),
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
      files: [file('file-00', { url: CDN_URL })],
      states: [completeState(CDN_HOST)],
    });
    env.deps.findFiles = async () => {
      throw new Error('completed config must not scan files');
    };
    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.docs[0]!.status, 'complete');
  });

  it('writes only changed urls and logs per-container counts', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [file('file-00'), file('file-01', { url: CDN_URL })],
    });
    await reconcileCdnConfiguration(env.deps);

    assert.deepEqual(env.fileWrites, [{ id: 'file-00', url: CDN_URL }]);
    assert.equal(env.files[0]!.sourceUrl, SOURCE);
    assert.equal(env.docs[0]!.status, 'complete');
    assert.equal(env.docs[0]!.appliedHost, CDN_HOST);
    assert.equal(env.docs[0]!.checkpointId, '');
    assert.ok(logs.some(m => /1 updated, 1 unchanged, 0 skipped/.test(m)));
  });

  it('pages by _id and resumes after the last successful page', async () => {
    const files = Array.from({ length: 5 }, (_, i) => file(`file-0${i}`));
    const env = harness({ config: { media: CDN_HOST }, files, batchSize: 2 });
    const realFind = env.deps.findFiles;
    let scans = 0;
    env.deps.findFiles = async (query, opts) => {
      if (++scans === 2) throw new Error('crash');
      return realFind(query, opts);
    };

    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /crash/);
    assert.equal(env.docs[0]!.status, 'pending');
    assert.equal(env.docs[0]!.checkpointId, 'file-01');
    assert.deepEqual(
      env.fileWrites.map(w => w.id),
      ['file-00', 'file-01'],
    );

    env.deps.findFiles = realFind;
    await reconcileCdnConfiguration(env.deps);
    assert.deepEqual(
      env.fileWrites.map(w => w.id),
      ['file-00', 'file-01', 'file-02', 'file-03', 'file-04'],
    );
    assert.ok(env.queries.some(q => q._id?.$gt === 'file-01'));
    assert.equal(env.docs[0]!.status, 'complete');
  });

  it('changes and removes hosts from the provider source without rewriting equal rows', async () => {
    const env = harness({
      config: { media: OTHER_HOST },
      files: [file('file-00', { url: 'https://cdn.example.test/media/renamed?sig=old' })],
      states: [completeState(CDN_HOST)],
    });
    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.files[0]!.url, reconciledFileUrl(SOURCE, OTHER_HOST));
    assert.equal(env.docs[0]!.appliedHost, OTHER_HOST);

    env.deps.readConfig = () => ({});
    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.files[0]!.url, SOURCE);
    assert.equal(env.docs[0]!.appliedHost, '');

    const scans = env.queries.length;
    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.queries.length, scans);
  });

  it('ignores private files, other containers, and files without a provider source', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [
        file('file-00'),
        file('file-01', { isPublic: false }),
        file('file-02', { container: 'archive' }),
        file('file-03', { sourceUrl: '', url: CDN_URL }),
        file('file-04', { sourceUrl: undefined, url: CDN_URL }),
      ],
    });
    await reconcileCdnConfiguration(env.deps);
    assert.deepEqual(
      env.fileWrites.map(w => w.id),
      ['file-00'],
    );
    assert.equal(env.queries[0]!.isPublic, true);
  });

  it('skips files with an invalid sourceUrl with a warning and completes', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [file('file-00', { sourceUrl: 'not a url', url: CDN_URL }), file('file-01')],
    });
    await reconcileCdnConfiguration(env.deps);

    assert.deepEqual(
      env.fileWrites.map(w => w.id),
      ['file-01'],
    );
    assert.ok(warnings.some(m => m.includes('file-00')));
    assert.equal(env.docs[0]!.status, 'complete');
    assert.ok(logs.some(m => /1 updated, 0 unchanged, 1 skipped/.test(m)));
  });

  it('continues when a conditional write misses because the row changed', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [file('file-00'), file('file-01')],
    });
    const realUpdate = env.deps.updateFileUrl;
    env.deps.updateFileUrl = async (id, observed, next) => {
      if (id === 'file-00') env.files[0]!.url = 'https://someone.else/changed';
      return realUpdate(id, observed, next);
    };
    await reconcileCdnConfiguration(env.deps);

    assert.equal(env.files[0]!.url, 'https://someone.else/changed');
    assert.equal(env.files[1]!.url, CDN_URL);
    assert.equal(env.docs[0]!.status, 'complete');
    assert.ok(warnings.some(m => m.includes('file-00')));
  });

  it('writes the rows of a page concurrently, capped per chunk', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: Array.from({ length: 25 }, (_, i) =>
        file(`file-${String(i).padStart(2, '0')}`),
      ),
    });
    const realUpdate = env.deps.updateFileUrl;
    let inFlight = 0;
    let peak = 0;
    env.deps.updateFileUrl = async (...args) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight -= 1;
      return realUpdate(...args);
    };
    await reconcileCdnConfiguration(env.deps);
    assert.equal(peak, CDN_WRITE_CONCURRENCY);
    assert.equal(env.fileWrites.length, 25);
  });

  it('does not checkpoint or complete when a page write fails', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      batchSize: 2,
      files: [file('file-00'), file('file-01'), file('file-02')],
    });
    env.deps.updateFileUrl = async () => {
      throw new Error('write failed');
    };
    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /write failed/);
    assert.equal(env.docs[0]!.status, 'pending');
    assert.equal(env.docs[0]!.checkpointId, '');
  });

  it('treats lease loss as a failure and does not complete', async () => {
    const controller = new AbortController();
    const env = harness({
      config: { media: CDN_HOST },
      batchSize: 2,
      files: [file('file-00'), file('file-01')],
      usingLock: async (_resource, _ttl, fn) => fn(controller.signal),
    });
    const realUpdate = env.deps.updateFileUrl;
    env.deps.updateFileUrl = async (...args) => {
      controller.abort();
      return realUpdate(...args);
    };
    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /lease expired/);
    assert.equal(env.docs[0]!.status, 'pending');
    assert.equal(env.docs[0]!.checkpointId, '');
  });

  it('returns busy when another replica holds the lock', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      files: [file('file-00')],
      usingLock: async resource => {
        assert.equal(resource, CDN_RECONCILIATION_LOCK);
        throw executionError(new redlock.ResourceLockedError('locked'));
      },
    });
    assert.equal(await reconcileCdnConfiguration(env.deps), 'busy');
    assert.equal(env.queries.length, 0);
    assert.equal(env.docs.length, 0);
    assert.ok(logs.some(m => /another replica/.test(m)));
  });

  it('does not mistake a Redis outage for a held lock', async () => {
    const env = harness({ config: {}, files: [] });
    env.deps.usingLock = async () => {
      throw executionError(new Error('connect ECONNREFUSED'));
    };
    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /quorum/);
    env.deps.usingLock = async () => {
      throw new Error('redis down');
    };
    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /redis down/);
  });

  it('still fails on errors after acquisition even if they look like contention', async () => {
    const env = harness({ config: {}, files: [] });
    env.deps.usingLock = async (_resource, _ttl, fn) => {
      await fn(new AbortController().signal);
      throw executionError(new redlock.ResourceLockedError('locked'));
    };
    await assert.rejects(() => reconcileCdnConfiguration(env.deps), /quorum/);
  });

  it('rescans a forced container whose state says complete, writing only unequal rows', async () => {
    const env = harness({
      config: { media: CDN_HOST },
      // An upload on another replica landed the old host behind the checkpoint.
      files: [file('file-00', { url: CDN_URL }), file('file-01', { url: SOURCE })],
      states: [completeState(CDN_HOST)],
    });
    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.queries.length, 0);

    env.deps.force = ['media'];
    await reconcileCdnConfiguration(env.deps);
    assert.deepEqual(
      env.fileWrites.map(w => w.id),
      ['file-01'],
    );
    assert.equal(env.docs[0]!.status, 'complete');
    assert.equal(env.docs[0]!.appliedHost, CDN_HOST);
  });

  it('retargets when config changes and refuses to finish while it keeps changing', async () => {
    const files = Array.from({ length: 3 }, (_, i) => file(`file-0${i}`));
    let host = CDN_HOST;
    const env = harness({ config: {}, files, batchSize: 2 });
    env.deps.readConfig = () => ({ media: host });
    const realUpdate = env.deps.updateFileUrl;
    env.deps.updateFileUrl = async (...args) => {
      host = OTHER_HOST;
      return realUpdate(...args);
    };

    await reconcileCdnConfiguration(env.deps);
    assert.equal(env.docs[0]!.appliedHost, OTHER_HOST);
    for (const f of files) assert.equal(f.url, reconciledFileUrl(SOURCE, OTHER_HOST));

    let version = 0;
    env.deps.readConfig = () => ({ media: `cdn-${++version}.example.test` });
    await assert.rejects(
      () => reconcileCdnConfiguration(env.deps),
      /changed during reconciliation/,
    );
    assert.notEqual(env.docs[0]!.status, 'complete');
  });

  it('does not finish on the previous host when config changes on the final page', async () => {
    let completedOld = false;
    const env = harness({ config: {}, files: [file('file-00')] });
    env.deps.readConfig = () => ({ media: completedOld ? OTHER_HOST : CDN_HOST });
    const realUpdateState = env.deps.updateState;
    env.deps.updateState = async (container, patch) => {
      await realUpdateState(container, patch);
      if (patch.appliedHost === CDN_HOST) completedOld = true;
    };
    await reconcileCdnConfiguration(env.deps);
    assert.equal(completedOld, true);
    assert.equal(env.docs[0]!.appliedHost, OTHER_HOST);
    assert.equal(env.files[0]!.url, reconciledFileUrl(SOURCE, OTHER_HOST));
  });

  it('reconciles a container added while another container is in progress', async () => {
    const config: CdnConfiguration = { media: CDN_HOST };
    const env = harness({
      config,
      files: [file('file-media'), file('file-archive', { container: 'archive' })],
    });
    const realUpdate = env.deps.updateFileUrl;
    env.deps.updateFileUrl = async (id, ...rest) => {
      if (id === 'file-media') config.archive = OTHER_HOST;
      return realUpdate(id, ...rest);
    };
    await reconcileCdnConfiguration(env.deps);

    const archive = env.docs.find(doc => doc.container === 'archive');
    assert.equal(env.docs.find(doc => doc.container === 'media')?.appliedHost, CDN_HOST);
    assert.equal(archive?.appliedHost, OTHER_HOST);
    assert.equal(env.files[1]!.url, reconciledFileUrl(SOURCE, OTHER_HOST));
  });

  it('runs URI migration before CDN reconciliation and leaves cleared sources untouched', async () => {
    const files = [
      file('file-public'),
      file('file-private', { container: 'archive', url: CDN_URL }),
    ];
    const originalFile = File.getInstance.bind(File);
    const originalContainer = _StorageContainer.getInstance.bind(_StorageContainer);
    File.getInstance = (() => ({
      findMany: async (query: Record<string, any>, options: { limit?: number }) =>
        files
          .filter(f => !f.uri && (!query._id?.$gt || f._id > query._id.$gt))
          .slice(0, options.limit),
      findByIdAndUpdate: async (id: string, update: Record<string, string>) => {
        const found = files.find(candidate => candidate._id === id)!;
        Object.assign(found, update);
        return found;
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
      const env = harness({ config: { media: CDN_HOST, archive: CDN_HOST }, files });
      await reconcileCdnConfiguration(env.deps);

      assert.equal(files[0]!.url, CDN_URL);
      assert.equal(files[1]!.sourceUrl, '');
      assert.equal(files[1]!.url, '');
      assert.equal(
        env.fileWrites.some(w => w.id === 'file-private'),
        false,
      );
      assert.equal(env.docs.find(d => d.container === 'archive')?.status, 'complete');
    } finally {
      File.getInstance = originalFile;
      _StorageContainer.getInstance = originalContainer;
    }
  });
});

describe('changedCdnContainers', () => {
  it('lists added, removed and changed hosts only', () => {
    assert.deepEqual(
      changedCdnContainers({ a: 'x', b: 'y', c: 'z' }, { a: 'x', b: 'q', d: 'n' }),
      ['b', 'c', 'd'],
    );
  });
});

describe('CdnReconciliationRunner', () => {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  function runner(
    outcomes: Array<'done' | 'busy' | Error>,
    config: { current: CdnConfiguration },
  ) {
    const forces: string[][] = [];
    const instance = new CdnReconciliationRunner(
      async force => {
        forces.push(force);
        const next = outcomes.shift() ?? 'done';
        if (next instanceof Error) throw next;
        return next;
      },
      () => config.current,
      5,
    );
    return { instance, forces };
  }

  it('rethrows boot failures', async () => {
    const { instance } = runner([new Error('db down')], { current: {} });
    await assert.rejects(() => instance.run(true), /db down/);
  });

  it('logs runtime failures instead of rejecting', async () => {
    const { instance } = runner([new Error('db down')], { current: {} });
    await instance.run(false);
    instance.cancel();
    assert.equal(errors.length, 1);
    assert.match(errors[0]!, /db down/);
  });

  it('does not force at boot but forces hosts that changed since the last snapshot', async () => {
    const config = { current: { media: CDN_HOST } as CdnConfiguration };
    const { instance, forces } = runner([], config);
    await instance.run(true);
    await instance.run(false);
    config.current = { media: OTHER_HOST };
    await instance.run(false);
    assert.deepEqual(forces, [[], [], ['media']]);
  });

  it('keeps forcing until a changed host has been applied', async () => {
    const config = { current: { media: CDN_HOST } as CdnConfiguration };
    const { instance, forces } = runner(['done', new Error('boom'), 'done'], config);
    await instance.run(false);
    config.current = { media: OTHER_HOST };
    await instance.run(false);
    await sleep(30);
    assert.deepEqual(forces, [[], ['media'], ['media']]);
  });

  it('retries after a busy lock or a runtime failure, then stops', async () => {
    const { instance, forces } = runner(['busy', new Error('boom'), 'done'], {
      current: {},
    });
    await instance.run(false);
    await sleep(60);
    assert.equal(forces.length, 3);
    await sleep(30);
    assert.equal(forces.length, 3);
  });

  it('replaces a pending retry when new config arrives and cancel clears it', async () => {
    const { instance, forces } = runner(['busy', 'done'], { current: {} });
    await instance.run(false);
    await instance.run(false);
    await sleep(30);
    assert.equal(forces.length, 2);

    const second = runner(['busy'], { current: {} });
    await second.instance.run(false);
    second.instance.cancel();
    await sleep(30);
    assert.equal(second.forces.length, 1);
  });
});

describe('reconcileStoredCdnConfig', () => {
  const originalFile = File.getInstance.bind(File);
  const originalState = _StorageCdnState.getInstance.bind(_StorageCdnState);

  afterEach(() => {
    File.getInstance = originalFile;
    _StorageCdnState.getInstance = originalState;
  });

  function install(updateOne: (filter: any, patch: any) => Promise<unknown>) {
    const stateWrites: Array<{ filter: any; patch: any }> = [];
    File.getInstance = (() => ({
      findMany: async () => [{ _id: 'file-00', url: SOURCE, sourceUrl: SOURCE }],
      updateOne,
    })) as unknown as typeof File.getInstance;
    const rows: any[] = [];
    _StorageCdnState.getInstance = (() => ({
      findMany: async () => rows,
      findOne: async (filter: any) =>
        rows.find(row => row.container === filter.container) ?? null,
      create: async (doc: any) => {
        rows.push({ ...doc });
        stateWrites.push({ filter: null, patch: doc });
      },
      updateOne: async (filter: any, patch: any) => {
        Object.assign(
          rows.find(row => row.container === filter.container),
          patch,
        );
        stateWrites.push({ filter, patch });
      },
    })) as unknown as typeof _StorageCdnState.getInstance;
    return stateWrites;
  }

  const sdk = (config: CdnConfiguration) => {
    const controller = { getInstance: () => ({ config: { cdnConfiguration: config } }) };
    return {
      controller,
      grpcSdk: {
        state: {
          usingLock: (_r: string, _t: number, fn: any) =>
            fn(new AbortController().signal),
        },
      },
    };
  };

  async function run(config: CdnConfiguration) {
    const { ConfigController } = await import('@conduitplatform/module-tools');
    const original = ConfigController.getInstance;
    ConfigController.getInstance = sdk(config).controller.getInstance as never;
    try {
      await reconcileStoredCdnConfig(sdk(config).grpcSdk as never);
    } finally {
      ConfigController.getInstance = original;
    }
  }

  it('writes the url with a single-document conditional updateOne', async () => {
    const calls: Array<{ filter: any; patch: any }> = [];
    const stateWrites = install(async (filter, patch) => {
      calls.push({ filter, patch });
      return { _id: filter._id, ...patch };
    });
    await run({ media: CDN_HOST });

    assert.deepEqual(calls[0], {
      filter: { _id: 'file-00', url: SOURCE },
      patch: { url: CDN_URL },
    });
    assert.ok(stateWrites.every(w => !('fence' in w.patch)));
  });

  it('treats null and SQL not-found errors as a conditional-write miss', async () => {
    for (const miss of [
      async () => null,
      async () => {
        throw new Error('Document not found');
      },
      async () => {
        throw new Error("Document doesn't exist or can't be modified by user.");
      },
    ]) {
      logs.length = 0;
      install(miss);
      await run({ media: CDN_HOST });
      assert.ok(logs.some(m => /0 updated, 0 unchanged, 1 skipped/.test(m)));
    }
  });

  it('propagates other write errors', async () => {
    install(async () => {
      throw new Error('connection lost');
    });
    await assert.rejects(() => run({ media: CDN_HOST }), /connection lost/);
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

describe('replaceUrlHost', () => {
  it('replaces the authority regardless of case or an explicit default port', () => {
    assert.equal(
      replaceUrlHost('https://Account.Blob.Core.Windows.net/m/o?sig=1', CDN_HOST),
      'https://cdn.example.test/m/o?sig=1',
    );
    assert.equal(
      replaceUrlHost('https://h.example.com:443/m/o', CDN_HOST),
      'https://cdn.example.test/m/o',
    );
  });

  it('does not touch the host spelled inside the path or query', () => {
    assert.equal(
      replaceUrlHost('https://h.example.com/h.example.com?u=h.example.com', CDN_HOST),
      'https://cdn.example.test/h.example.com?u=h.example.com',
    );
  });

  it('throws for urls without a host', () => {
    assert.throws(() => replaceUrlHost('not a url', CDN_HOST));
  });
});

describe('cdn state schema', () => {
  it('requires one unique container field and has no fence', () => {
    const model = _StorageCdnState.getInstance({} as never);
    try {
      const container = model.fields.container as {
        unique?: boolean;
        required?: boolean;
      };
      assert.equal(container.required, true);
      assert.equal(container.unique, true);
      assert.equal('fence' in model.fields, false);
    } finally {
      (_StorageCdnState as unknown as { _instance?: unknown })._instance = undefined;
    }
  });
});
