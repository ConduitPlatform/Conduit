import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import type { Config } from '../config/index.js';
import type {
  EmbeddingDocumentRecord,
  EmbeddingSourceRecord,
  GenericSourceApi,
} from '../api/genericSourceApi.js';
import { FILE_LIFECYCLE_EVENTS } from './storageEventNames.js';
import { StorageExtractionPipeline, type StorageFileRecord } from './storagePipeline.js';
import { EMBEDDING_METRICS } from './embeddingMetrics.js';

const config = {
  enabled: true,
  security: {
    maxEmbedInputBytes: 1024,
    maxChunkTextBytes: 64,
    maxChunksPerDocument: 16,
  },
  storageExtraction: {
    maxFileBytes: 64,
    maxExtractedBytes: 64,
    maxPdfPages: 2,
    extractTimeoutMs: 1000,
    maxChunksPerFile: 8,
    chunkOverlapBytes: 4,
    queueConcurrency: 1,
    queueAttempts: 5,
  },
} as Config;

function matches(doc: object, query: Record<string, unknown>) {
  const record = doc as Record<string, unknown>;
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const ops = value as { $in?: unknown[]; $gt?: unknown; $regex?: string };
      if (ops.$in) return ops.$in.includes(record[key]);
      if (ops.$gt != null) return String(record[key]) > String(ops.$gt);
      if (ops.$regex) return new RegExp(ops.$regex).test(String(record[key] ?? ''));
    }
    return record[key] === value;
  });
}

function createHarness(args?: { sourceState?: EmbeddingSourceRecord['state'] }) {
  const sources: EmbeddingSourceRecord[] = [
    {
      _id: 'src-storage',
      kind: 'conduit-storage',
      state: args?.sourceState ?? 'ready',
      partitionSubject: 'Team:tenant-a',
      provider: 'openai-compatible',
      modelName: 'text-embedding-3-small',
      dimensions: 3,
      similarity: 'cosine',
      selectors: { container: 'docs', folderPrefix: 'inbox/', mimeTypes: ['text/plain'] },
    },
  ];
  const documents: EmbeddingDocumentRecord[] = [];
  const files: StorageFileRecord[] = [];
  const jobs: Array<{
    kind?: string;
    sourceId?: string;
    fileId?: string;
    reason?: string;
  }> = [];
  const syncs: Array<{
    storageFileId?: string;
    container?: string;
    chunks?: unknown;
    caller?: unknown;
  }> = [];
  const deletes: Array<{ externalDocumentId?: string }> = [];
  const byteReads: Array<{ id: string; maxBytes: number }> = [];
  const fileReads: string[] = [];

  const pipeline = new StorageExtractionPipeline({
    currentConfig: () => config,
    sources: {
      findMany: async query => sources.filter(source => matches(source, query)),
      findOne: async query => sources.find(source => matches(source, query)) ?? null,
    },
    documents: {
      findMany: async query => documents.filter(document => matches(document, query)),
      findOne: async query =>
        documents.find(document => matches(document, query)) ?? null,
      create: async doc => {
        const created = {
          _id: `doc${documents.length + 1}`,
          ...doc,
        } as EmbeddingDocumentRecord;
        documents.push(created);
        return created;
      },
      findByIdAndUpdate: async (id, doc) => {
        const index = documents.findIndex(document => document._id === id);
        if (index < 0) return null;
        documents[index] = { ...documents[index], ...doc } as EmbeddingDocumentRecord;
        return documents[index];
      },
    },
    listFiles: async (query, options) => {
      const matched = files.filter(file => matches(file, query));
      const sorted = [...matched].sort((a, b) => a._id.localeCompare(b._id));
      return sorted.slice(0, options?.limit ?? sorted.length);
    },
    getFile: async id => {
      fileReads.push(id);
      return files.find(file => file._id === id) ?? null;
    },
    getFileBytes: async (id, maxBytes) => {
      byteReads.push({ id, maxBytes });
      const file = files.find(item => item._id === id);
      if (!file) throw new Error('missing file');
      return {
        data: Buffer.from(
          (file as StorageFileRecord & { body?: string }).body ?? 'hello',
        ),
        mimeType: file.mimeType,
        name: file.name,
      };
    },
    enqueue: async queued => {
      jobs.push(...queued);
      return queued.length;
    },
    api: {
      syncDocument: async (
        request: {
          sourceId: string;
          externalDocumentId: string;
          contentVersion?: string;
          storageFileId?: string;
          mimeType?: string;
          container?: string;
          folder?: string;
          chunks: unknown[];
        },
        caller: unknown,
      ) => {
        syncs.push({ ...request, caller });
        const existing = documents.find(
          document =>
            document.sourceId === request.sourceId &&
            document.externalDocumentId === request.externalDocumentId,
        );
        const next = {
          _id: existing?._id ?? `doc${documents.length + 1}`,
          sourceId: request.sourceId,
          externalDocumentId: request.externalDocumentId,
          contentVersion: request.contentVersion,
          storageFileId: request.storageFileId,
          mimeType: request.mimeType,
          container: request.container,
          folder: request.folder,
          partitionSubject: 'Team:tenant-a',
          status: 'indexed' as const,
        };
        if (existing) {
          Object.assign(existing, next);
        } else {
          documents.push(next);
        }
        return {
          documentId: next._id,
          sourceId: request.sourceId,
          externalDocumentId: request.externalDocumentId,
          status: 'indexed',
          replaced: Boolean(existing),
          chunks: [],
        };
      },
      deleteDocument: async (request: {
        sourceId: string;
        externalDocumentId: string;
      }) => {
        deletes.push(request);
        const index = documents.findIndex(
          document =>
            document.sourceId === request.sourceId &&
            document.externalDocumentId === request.externalDocumentId,
        );
        if (index >= 0) documents.splice(index, 1);
        return { documentId: 'gone', deletedChunks: 1 };
      },
    } as unknown as GenericSourceApi,
  });

  return {
    pipeline,
    sources,
    documents,
    files,
    jobs,
    syncs,
    deletes,
    byteReads,
    fileReads,
  };
}

describe('storage extraction pipeline', () => {
  it('enqueues only matching ready files and ignores pending', async () => {
    const { pipeline, jobs } = createHarness();
    const queued = await pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.ready,
      JSON.stringify({
        id: 'file-1',
        container: 'docs',
        folder: 'inbox/',
        mimeType: 'text/plain',
        contentVersion: 'v1',
      }),
    );
    const pending = await pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.ready,
      JSON.stringify({
        id: 'file-pending',
        container: 'docs',
        folder: 'inbox/',
        mimeType: 'text/plain',
        uploadStatus: 'pending',
        contentVersion: 'v0',
      }),
    );
    const other = await pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.ready,
      JSON.stringify({
        id: 'file-other',
        container: 'other',
        folder: 'inbox/',
        mimeType: 'text/plain',
        contentVersion: 'v1',
      }),
    );
    assert.equal(queued, 1);
    assert.equal(pending, 0);
    assert.equal(other, 0);
    assert.equal(jobs[0]?.kind, 'ingest');
    assert.equal(jobs[0]?.sourceId, 'src-storage');
    assert.equal(jobs[0]?.fileId, 'file-1');
  });

  it('ingests through bounded gRPC bytes, carries source partition, and drops text', async () => {
    const harness = createHarness();
    harness.files.push({
      _id: 'file-1',
      name: 'note.txt',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      size: 5,
      contentVersion: 'v1',
      ...({ body: 'hello' } as object),
    } as StorageFileRecord);
    await harness.pipeline.processJob({
      kind: 'ingest',
      sourceId: 'src-storage',
      fileId: 'file-1',
      contentVersion: 'v1',
      reason: 'ready',
    });
    assert.deepEqual(harness.byteReads, [{ id: 'file-1', maxBytes: 64 }]);
    assert.equal(harness.syncs[0]?.storageFileId, 'file-1');
    assert.equal(harness.syncs[0]?.container, 'docs');
    assert.match(JSON.stringify(harness.syncs[0]?.chunks), /hello/);
    assert.equal(harness.documents[0]?.partitionSubject, 'Team:tenant-a');
    assert.equal(harness.documents[0]?.status, 'indexed');
    assert.equal('text' in (harness.documents[0] ?? {}), false);
    assert.equal(harness.documents[0]?.storageFileId, 'file-1');
    await harness.pipeline.processJob({
      kind: 'ingest',
      sourceId: 'src-storage',
      fileId: 'file-1',
      contentVersion: 'v1',
      reason: 'update',
    });
    assert.equal(harness.syncs.length, 1);
  });

  it('increments extracted and skipped counters without file identifiers', async () => {
    const seen: Array<{ name: string; labels?: unknown }> = [];
    const previous = ConduitGrpcSdk.Metrics;
    ConduitGrpcSdk.Metrics = {
      increment(name: string, _amount?: number, labels?: unknown) {
        seen.push({ name, labels });
      },
    } as never;
    try {
      const harness = createHarness();
      harness.files.push({
        _id: 'file-1',
        container: 'docs',
        folder: 'inbox/',
        mimeType: 'text/plain',
        contentVersion: 'v1',
        ...({ body: 'hello' } as object),
      } as StorageFileRecord);
      await harness.pipeline.processJob({
        kind: 'ingest',
        sourceId: 'src-storage',
        fileId: 'file-1',
        reason: 'ready',
      });
      await harness.pipeline.processJob({
        kind: 'ingest',
        sourceId: 'src-storage',
        fileId: 'file-bin',
        reason: 'ready',
      });
      assert.deepEqual(
        seen.map(item => item.name),
        [EMBEDDING_METRICS.storageExtracted, EMBEDDING_METRICS.storageSkipped],
      );
      assert.equal(
        seen.every(item => item.labels === undefined),
        true,
      );
      assert.equal(JSON.stringify(seen).includes('file-'), false);
    } finally {
      ConduitGrpcSdk.Metrics = previous;
    }
  });

  it('replaces on contentVersion change and skips disabled ingest', async () => {
    const ready = createHarness();
    ready.files.push({
      _id: 'file-1',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      contentVersion: 'v2',
      ...({ body: 'newer text' } as object),
    } as StorageFileRecord);
    ready.documents.push({
      _id: 'doc1',
      sourceId: 'src-storage',
      externalDocumentId: 'file-1',
      storageFileId: 'file-1',
      contentVersion: 'v1',
      partitionSubject: 'Team:tenant-a',
      status: 'indexed',
    });
    await ready.pipeline.processJob({
      kind: 'ingest',
      sourceId: 'src-storage',
      fileId: 'file-1',
      contentVersion: 'v2',
      reason: 'update',
    });
    assert.equal(ready.syncs.length, 1);
    assert.equal(ready.documents[0]?.contentVersion, 'v2');

    const disabled = createHarness({ sourceState: 'disabled' });
    disabled.files.push({
      _id: 'file-1',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      contentVersion: 'v1',
    });
    await disabled.pipeline.processJob({
      kind: 'ingest',
      sourceId: 'src-storage',
      fileId: 'file-1',
      reason: 'ready',
    });
    assert.equal(disabled.syncs.length, 0);
  });

  it('deletes individual, bulk, folder, and container documents', async () => {
    const harness = createHarness();
    harness.documents.push(
      {
        _id: 'd1',
        sourceId: 'src-storage',
        externalDocumentId: 'file-1',
        storageFileId: 'file-1',
        container: 'docs',
        folder: 'inbox/a/',
        partitionSubject: 'Team:tenant-a',
        status: 'indexed',
      },
      {
        _id: 'd2',
        sourceId: 'src-storage',
        externalDocumentId: 'file-2',
        storageFileId: 'file-2',
        container: 'docs',
        folder: 'inbox/b/',
        partitionSubject: 'Team:tenant-a',
        status: 'indexed',
      },
      {
        _id: 'd3',
        sourceId: 'src-storage',
        externalDocumentId: 'file-3',
        storageFileId: 'file-3',
        container: 'docs',
        folder: 'other/',
        partitionSubject: 'Team:tenant-a',
        status: 'indexed',
      },
    );
    await harness.pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.delete,
      JSON.stringify({ id: 'file-1', container: 'docs' }),
    );
    await harness.pipeline.processJob({
      kind: 'delete',
      sourceId: 'src-storage',
      fileId: 'file-1',
      reason: 'delete',
    });
    await harness.pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.deleteMany,
      JSON.stringify({ ids: ['file-2'], container: 'docs' }),
    );
    await harness.pipeline.processJob({
      kind: 'delete',
      sourceId: 'src-storage',
      fileId: 'file-2',
      reason: 'delete',
    });
    await harness.pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.deleteFolder,
      JSON.stringify({ name: 'inbox/', container: 'docs' }),
    );
    await harness.pipeline.processJob({
      kind: 'deleteFolder',
      sourceId: 'src-storage',
      container: 'docs',
      folder: 'inbox/',
      reason: 'delete',
    });
    await harness.pipeline.handleBusEvent(
      FILE_LIFECYCLE_EVENTS.deleteContainer,
      JSON.stringify({ name: 'docs' }),
    );
    await harness.pipeline.processJob({
      kind: 'deleteContainer',
      sourceId: 'src-storage',
      container: 'docs',
      reason: 'delete',
    });
    assert.equal(
      harness.deletes.some(item => item.externalDocumentId === 'file-1'),
      true,
    );
    assert.equal(
      harness.deletes.some(item => item.externalDocumentId === 'file-2'),
      true,
    );
    assert.equal(
      harness.deletes.some(item => item.externalDocumentId === 'file-3'),
      true,
    );
    assert.equal(harness.documents.length, 0);
  });

  it('reconciles missed files and deletes stale indexed documents', async () => {
    const harness = createHarness();
    harness.files.push({
      _id: 'file-live',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      contentVersion: 'v9',
    });
    harness.documents.push({
      _id: 'stale',
      sourceId: 'src-storage',
      externalDocumentId: 'file-gone',
      storageFileId: 'file-gone',
      container: 'docs',
      folder: 'inbox/',
      partitionSubject: 'Team:tenant-a',
      status: 'indexed',
    });
    const result = await harness.pipeline.reconcileSource('src-storage', {
      callerModule: 'embeddings',
    });
    assert.equal(result.scanned, 1);
    assert.equal(result.queued, 2);
    assert.equal(
      harness.jobs.some(
        job =>
          job.kind === 'ingest' &&
          job.fileId === 'file-live' &&
          job.reason === 'reconcile',
      ),
      true,
    );
    assert.equal(
      harness.jobs.some(job => job.kind === 'delete' && job.fileId === 'file-gone'),
      true,
    );
  });

  it('marks MIME mismatches skipped and still deletes when the source is revoked', async () => {
    const harness = createHarness();
    harness.files.push({
      _id: 'file-bin',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'application/zip',
      contentVersion: 'v1',
    });
    await harness.pipeline.processJob({
      kind: 'ingest',
      sourceId: 'src-storage',
      fileId: 'file-bin',
      reason: 'ready',
    });
    assert.equal(harness.documents[0]?.status, 'skipped');
    assert.equal(harness.syncs.length, 0);

    harness.sources[0].state = 'revoked';
    harness.documents[0].status = 'indexed';
    harness.documents[0].externalDocumentId = 'file-bin';
    harness.documents[0].storageFileId = 'file-bin';
    await harness.pipeline.processJob({
      kind: 'delete',
      sourceId: 'src-storage',
      fileId: 'file-bin',
      reason: 'delete',
    });
    assert.equal(harness.deletes.length, 1);
  });
});
