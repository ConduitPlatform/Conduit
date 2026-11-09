import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import {
  ConduitGrpcSdk,
  type DatabaseProvider,
  type IConduitLogger,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { File } from '../models/index.js';
import { type CdnConfiguration, migrateCdnConfigChanges } from './cdnConfigMigration.js';

const ORIGIN_URL = 'https://origin.example/media/object.bin?sv=1&sig=token';
const CDN_URL = 'https://cdn.example/media/object.bin?sv=1&sig=token';
const STALE_URL = 'https://old.example/other/path?stale=1';

type StoredFile = {
  _id: string;
  container: string;
  isPublic: boolean;
  url?: string;
  sourceUrl?: string;
};

type FileQuery = {
  container?: string;
  isPublic?: boolean;
};

const logs: string[] = [];
const errors: string[] = [];
const state: {
  rows: StoredFile[];
  queries: FileQuery[];
  updates: { id: string; document: { url?: string } }[];
  failUpdateId?: string;
  findManyError?: Error;
} = {
  rows: [],
  queries: [],
  updates: [],
};

function resetState(): void {
  state.rows = [];
  state.queries = [];
  state.updates = [];
  state.failUpdateId = undefined;
  state.findManyError = undefined;
  logs.length = 0;
  errors.length = 0;
}

function setCdnConfiguration(cdnConfiguration: CdnConfiguration): void {
  ConfigController.getInstance().config = { cdnConfiguration };
}

let sdk: ConduitGrpcSdk;

function migrate(previous: CdnConfiguration): Promise<void> {
  return migrateCdnConfigChanges(sdk, previous);
}

before(() => {
  const logger = {
    log(message: string) {
      logs.push(message);
    },
    error(message: string | Error) {
      errors.push(message instanceof Error ? message.message : message);
    },
  } as IConduitLogger;
  sdk = new ConduitGrpcSdk('127.0.0.1:55152', 'cdn-migration-test', false, logger);
  const database = {
    async findMany(_schemaName: string, query: FileQuery): Promise<StoredFile[]> {
      state.queries.push(query);
      if (state.findManyError) {
        throw state.findManyError;
      }
      return state.rows.filter(row => {
        if (query.container !== undefined && row.container !== query.container) {
          return false;
        }
        if (query.isPublic !== undefined && row.isPublic !== query.isPublic) {
          return false;
        }
        return true;
      });
    },
    async findByIdAndUpdate(
      _schemaName: string,
      id: string,
      document: { url?: string },
    ): Promise<StoredFile | null> {
      if (state.failUpdateId === id) {
        throw new Error('database update failed');
      }
      const row = state.rows.find(candidate => candidate._id === id);
      state.updates.push({ id, document: { ...document } });
      if (row && document.url !== undefined) {
        row.url = document.url;
      }
      return row ?? null;
    },
  } as unknown as DatabaseProvider;
  File.getInstance(database);
});

describe('migrateCdnConfigChanges', () => {
  beforeEach(() => {
    resetState();
  });

  it('scans again but does not write when a restarted process sees the same CDN urls', async () => {
    state.rows = [
      {
        _id: 'ready',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: CDN_URL,
      },
    ];
    setCdnConfiguration({ media: 'cdn.example' });

    await migrate({});
    await migrate({});

    assert.equal(state.updates.length, 0);
    assert.deepEqual(state.queries, [
      { container: 'media', isPublic: true },
      { container: 'media', isPublic: true },
    ]);
    assert.equal(
      logs.filter(message =>
        message.includes(
          'scanned 1 public file(s), updated 0, skipped 1 unchanged, skipped 0 without sourceUrl',
        ),
      ).length,
      2,
    );
    assert.equal(
      logs.filter(message =>
        message.includes(
          'migration completed: updated 0, skipped 1 unchanged, skipped 0 without sourceUrl',
        ),
      ).length,
      2,
    );

    const queriesBeforeEqualConfig = state.queries.length;
    await migrate({ media: 'cdn.example' });
    assert.equal(state.queries.length, queriesBeforeEqualConfig);
    assert.equal(state.updates.length, 0);
  });

  it('writes the url computed from sourceUrl and keeps that sourceUrl', async () => {
    state.rows = [
      {
        _id: 'stale',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: STALE_URL,
      },
    ];
    setCdnConfiguration({ media: 'cdn.example' });

    await migrate({});

    assert.deepEqual(state.updates, [{ id: 'stale', document: { url: CDN_URL } }]);
    assert.equal(state.rows[0].sourceUrl, ORIGIN_URL);
    assert.match(logs.join('\n'), /updated 1, skipped 0 unchanged/);
  });

  it('updates only the public row whose computed url differs', async () => {
    state.rows = [
      {
        _id: 'unchanged',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: CDN_URL,
      },
      {
        _id: 'stale',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: ORIGIN_URL,
      },
      {
        _id: 'no-source',
        container: 'media',
        isPublic: true,
        url: ORIGIN_URL,
      },
      {
        _id: 'private',
        container: 'media',
        isPublic: false,
        sourceUrl: ORIGIN_URL,
        url: ORIGIN_URL,
      },
      {
        _id: 'other-container',
        container: 'archive',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: ORIGIN_URL,
      },
    ];
    setCdnConfiguration({ media: 'cdn.example' });

    await migrate({});

    assert.deepEqual(state.queries, [{ container: 'media', isPublic: true }]);
    assert.deepEqual(
      state.updates.map(update => update.id),
      ['stale'],
    );
    assert.equal(state.updates[0].document.url, CDN_URL);
    assert.equal(state.rows.find(row => row._id === 'private')?.url, ORIGIN_URL);
    assert.equal(state.rows.find(row => row._id === 'no-source')?.url, ORIGIN_URL);
    assert.match(
      logs.join('\n'),
      /scanned 3 public file\(s\), updated 1, skipped 1 unchanged, skipped 1 without sourceUrl/,
    );
  });

  it('does not scan a container whose CDN host did not change', async () => {
    state.rows = [
      {
        _id: 'archive-file',
        container: 'archive',
        isPublic: true,
        sourceUrl: 'https://origin.example/archive/object.bin',
        url: 'https://origin.example/archive/object.bin',
      },
    ];
    setCdnConfiguration({ media: 'cdn.example', archive: 'archive.example' });

    await migrate({ media: 'previous.example', archive: 'archive.example' });

    assert.deepEqual(state.queries, [{ container: 'media', isPublic: true }]);
    assert.equal(state.updates.length, 0);
  });

  it('restores the provider host from sourceUrl when the CDN host is removed', async () => {
    state.rows = [
      {
        _id: 'restore',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: CDN_URL,
      },
      {
        _id: 'already-provider',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: ORIGIN_URL,
      },
      {
        _id: 'cdn-only',
        container: 'media',
        isPublic: true,
        url: CDN_URL,
      },
    ];
    setCdnConfiguration({});

    await migrate({ media: 'cdn.example' });

    assert.deepEqual(state.updates, [{ id: 'restore', document: { url: ORIGIN_URL } }]);
    assert.equal(state.rows.find(row => row._id === 'restore')?.sourceUrl, ORIGIN_URL);
    assert.equal(state.rows.find(row => row._id === 'cdn-only')?.url, CDN_URL);
    assert.match(
      logs.join('\n'),
      /scanned 3 public file\(s\), updated 1, skipped 1 unchanged, skipped 1 without sourceUrl/,
    );
  });

  it('rejects when a file update fails and a later run writes only the remaining row', async () => {
    state.rows = [
      {
        _id: 'written',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: ORIGIN_URL,
      },
      {
        _id: 'failed',
        container: 'media',
        isPublic: true,
        sourceUrl: ORIGIN_URL,
        url: ORIGIN_URL,
      },
    ];
    state.failUpdateId = 'failed';
    setCdnConfiguration({ media: 'cdn.example' });

    await assert.rejects(migrate({}), { message: 'database update failed' });

    assert.deepEqual(
      state.updates.map(update => update.id),
      ['written'],
    );
    assert.equal(state.rows.find(row => row._id === 'written')?.url, CDN_URL);
    assert.equal(state.rows.find(row => row._id === 'written')?.sourceUrl, ORIGIN_URL);
    assert.equal(state.rows.find(row => row._id === 'failed')?.url, ORIGIN_URL);
    assert.match(errors.join('\n'), /container "media"/);
    assert.match(errors.join('\n'), /database update failed/);
    assert.equal(
      logs.some(message => message.includes('migration completed')),
      false,
    );

    state.failUpdateId = undefined;
    state.updates.length = 0;
    logs.length = 0;
    errors.length = 0;
    await migrate({});

    assert.deepEqual(state.updates, [{ id: 'failed', document: { url: CDN_URL } }]);
    assert.match(logs.join('\n'), /migration completed: updated 1, skipped 1 unchanged/);
  });

  it('rejects when listing public files fails', async () => {
    state.findManyError = new Error('database read failed');
    setCdnConfiguration({ media: 'cdn.example' });

    await assert.rejects(migrate({}), { message: 'database read failed' });

    assert.equal(state.updates.length, 0);
    assert.match(errors.join('\n'), /container "media"/);
    assert.match(errors.join('\n'), /database read failed/);
    assert.equal(
      logs.some(message => message.includes('migration completed')),
      false,
    );
  });
});
