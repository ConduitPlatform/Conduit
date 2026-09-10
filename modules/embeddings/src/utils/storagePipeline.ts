import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import type { Config } from '../config/index.js';
import type {
  EmbeddingDocumentRecord,
  EmbeddingSourceRecord,
  GenericSourceApi,
} from '../api/genericSourceApi.js';
import { FILE_LIFECYCLE_EVENTS } from './storageEventNames.js';
import {
  parseStorageBusMessage,
  parseStorageContainerEvent,
  parseStorageDeleteManyEvent,
  parseStorageFileEvent,
  parseStorageFolderEvent,
} from './storageEvents.js';
import { isFileBytesReady } from './storageFileState.js';
import {
  fileMatchesSelectors,
  parseStorageSelectors,
  type StorageSourceSelectors,
} from './storageSelectors.js';
import { dedupeStorageIngestJobs, type StorageIngestJobData } from './storageJobs.js';
import { assertAutomaticExtractable, sniffMimeType } from './mimeSniff.js';
import { extractCsvText, extractJsonText, extractUtf8Text } from './textExtract.js';
import { extractPdfText } from './pdfExtract.js';
import { chunkExtractedText } from './storageChunker.js';
import { storageExtractionLimits } from './storageLimits.js';
import { incrementEmbeddingMetric } from './embeddingMetrics.js';
import { sanitizeErrorMessage } from './redactConfig.js';

export interface StorageFileRecord {
  _id: string;
  name?: string;
  container?: string;
  folder?: string;
  mimeType?: string;
  size?: number;
  uploadStatus?: string;
  contentVersion?: string;
}

export interface StoragePipelineDeps {
  currentConfig: () => Config;
  sources: {
    findMany: (query: Record<string, unknown>) => Promise<EmbeddingSourceRecord[]>;
    findOne: (query: Record<string, unknown>) => Promise<EmbeddingSourceRecord | null>;
  };
  documents: {
    findMany: (query: Record<string, unknown>) => Promise<EmbeddingDocumentRecord[]>;
    findOne: (query: Record<string, unknown>) => Promise<EmbeddingDocumentRecord | null>;
    create: (doc: Record<string, unknown>) => Promise<EmbeddingDocumentRecord>;
    findByIdAndUpdate: (
      id: string,
      doc: Record<string, unknown>,
    ) => Promise<EmbeddingDocumentRecord | null>;
  };
  listFiles: (
    query: Record<string, unknown>,
    options?: { skip?: number; limit?: number; sort?: Record<string, unknown> },
  ) => Promise<StorageFileRecord[]>;
  getFile: (
    id: string,
    options?: { scope?: string },
  ) => Promise<StorageFileRecord | null>;
  getFileBytes: (
    id: string,
    maxBytes: number,
    options?: { scope?: string },
  ) => Promise<{ data: Buffer; mimeType?: string; name?: string }>;
  canReadFile?: (fileId: string, subject: string) => Promise<boolean>;
  enqueue: (jobs: StorageIngestJobData[]) => Promise<number>;
  api: GenericSourceApi;
}

const RECONCILE_PAGE = 50;

export class StorageExtractionPipeline {
  constructor(private readonly deps: StoragePipelineDeps) {}

  async handleBusEvent(channel: string, message: string): Promise<number> {
    const payload = parseStorageBusMessage(message);
    if (payload == null) return 0;
    if (
      channel === FILE_LIFECYCLE_EVENTS.ready ||
      channel === FILE_LIFECYCLE_EVENTS.update
    ) {
      const file = parseStorageFileEvent(payload);
      if (!file) return 0;
      return this.enqueueForFile(
        file,
        channel === FILE_LIFECYCLE_EVENTS.ready ? 'ready' : 'update',
      );
    }
    if (channel === FILE_LIFECYCLE_EVENTS.delete) {
      const file = parseStorageFileEvent(payload);
      if (!file) return 0;
      return this.enqueueDeletes([file.id], file);
    }
    if (channel === FILE_LIFECYCLE_EVENTS.deleteMany) {
      const bulk = parseStorageDeleteManyEvent(payload);
      if (!bulk) return 0;
      return this.enqueueDeletes(bulk.ids, bulk);
    }
    if (channel === FILE_LIFECYCLE_EVENTS.deleteFolder) {
      const folder = parseStorageFolderEvent(payload);
      if (!folder) return 0;
      return this.enqueueFolderDeletes(folder.container, folder.name);
    }
    if (channel === FILE_LIFECYCLE_EVENTS.deleteContainer) {
      const container = parseStorageContainerEvent(payload);
      if (!container) return 0;
      return this.enqueueContainerDeletes(container.container ?? container.name);
    }
    return 0;
  }

  async reconcileSource(
    sourceId: string,
    _caller: { platformAdmin?: boolean; callerModule?: string },
  ) {
    const source = await this.requireStorageSource(sourceId);
    if (source.state !== 'ready') {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Embedding source '${source._id}' is not ready for reconcile`,
      );
    }
    const selectors = parseStorageSelectors(source.selectors);
    const matchingIds = new Set<string>();
    const jobs: StorageIngestJobData[] = [];
    let scanned = 0;
    let cursor: string | undefined;
    for (;;) {
      const files = await this.deps.listFiles(
        {
          container: selectors.container,
          ...(selectors.folderPrefix
            ? { folder: { $regex: `^${escapeRegex(selectors.folderPrefix)}` } }
            : {}),
          ...(cursor ? { _id: { $gt: cursor } } : {}),
        },
        { limit: RECONCILE_PAGE, sort: { _id: 1 } },
      );
      if (!files.length) break;
      for (const file of files) {
        scanned += 1;
        cursor = file._id;
        if (!fileMatchesSelectors(file, selectors)) continue;
        if (!(await this.isAuthorizedForFile(source, file._id))) continue;
        matchingIds.add(file._id);
        jobs.push({
          kind: 'ingest',
          sourceId: source._id,
          fileId: file._id,
          contentVersion: file.contentVersion,
          reason: 'reconcile',
        });
      }
      if (files.length < RECONCILE_PAGE) break;
    }
    const indexed = await this.deps.documents.findMany({
      sourceId: source._id,
      status: { $in: ['indexed', 'queued', 'extracting', 'failed', 'skipped'] },
    });
    for (const document of indexed) {
      const fileId = document.storageFileId ?? document.externalDocumentId;
      if (!matchingIds.has(fileId)) {
        jobs.push({
          kind: 'delete',
          sourceId: source._id,
          fileId,
          reason: 'delete',
        });
      }
    }
    const queued = await this.deps.enqueue(dedupeStorageIngestJobs(jobs));
    return { queued, scanned, warnings: [] as string[] };
  }

  async processJob(job: StorageIngestJobData): Promise<void> {
    const source = await this.deps.sources.findOne({ _id: job.sourceId });
    if (!source) return;
    if (job.kind === 'ingest') {
      if (source.state !== 'ready') return;
      await this.ingestFile(source, job.fileId!);
      return;
    }
    if (job.kind === 'delete' && job.fileId) {
      await this.deleteFileDocument(source, job.fileId);
      return;
    }
    if (job.kind === 'deleteMany') {
      for (const fileId of job.fileIds ?? []) {
        await this.deleteFileDocument(source, fileId);
      }
      return;
    }
    if (job.kind === 'deleteFolder' && job.container && job.folder) {
      const documents = await this.deps.documents.findMany({
        sourceId: source._id,
        container: job.container,
      });
      for (const document of documents) {
        if ((document.folder ?? '').startsWith(job.folder)) {
          await this.deleteFileDocument(
            source,
            document.storageFileId ?? document.externalDocumentId,
          );
        }
      }
      return;
    }
    if (job.kind === 'deleteContainer' && job.container) {
      const documents = await this.deps.documents.findMany({
        sourceId: source._id,
        container: job.container,
      });
      for (const document of documents) {
        await this.deleteFileDocument(
          source,
          document.storageFileId ?? document.externalDocumentId,
        );
      }
    }
  }

  private async enqueueForFile(
    file: {
      id: string;
      contentVersion?: string;
      container?: string;
      folder?: string;
      mimeType?: string;
      uploadStatus?: string;
    },
    reason: 'ready' | 'update',
  ): Promise<number> {
    const sources = await this.matchingSources(file);
    const jobs = sources.map(source => ({
      kind: 'ingest' as const,
      sourceId: source._id,
      fileId: file.id,
      contentVersion: file.contentVersion,
      reason,
    }));
    for (const source of sources) {
      await this.markDocument(source, file.id, 'queued');
    }
    return this.deps.enqueue(jobs);
  }

  private async enqueueDeletes(
    ids: string[],
    context: { container?: string; folder?: string },
  ): Promise<number> {
    const sources = await this.deletableStorageSources();
    const jobs = sources
      .filter(source => {
        const selectors = safeSelectors(source);
        return (
          !selectors || selectors.container === (context.container ?? selectors.container)
        );
      })
      .flatMap(source =>
        ids.map(fileId => ({
          kind: 'delete' as const,
          sourceId: source._id,
          fileId,
          reason: 'delete' as const,
        })),
      );
    return this.deps.enqueue(jobs);
  }

  private async enqueueFolderDeletes(container: string, folder: string): Promise<number> {
    const sources = await this.deletableStorageSources();
    return this.deps.enqueue(
      sources.map(source => ({
        kind: 'deleteFolder' as const,
        sourceId: source._id,
        container,
        folder,
        reason: 'delete' as const,
      })),
    );
  }

  private async enqueueContainerDeletes(container: string): Promise<number> {
    const sources = await this.deletableStorageSources();
    return this.deps.enqueue(
      sources
        .filter(source => safeSelectors(source)?.container === container)
        .map(source => ({
          kind: 'deleteContainer' as const,
          sourceId: source._id,
          container,
          reason: 'delete' as const,
        })),
    );
  }

  private async ingestFile(source: EmbeddingSourceRecord, fileId: string): Promise<void> {
    const liveSource = await this.deps.sources.findOne({ _id: source._id });
    if (!liveSource || liveSource.state !== 'ready') return;
    const selectors = parseStorageSelectors(liveSource.selectors);
    const file = await this.deps.getFile(fileId, {
      scope: liveSource.partitionSubject,
    });
    if (
      !file ||
      !isFileBytesReady(file) ||
      !fileMatchesSelectors(file, selectors) ||
      !(await this.isAuthorizedForFile(liveSource, fileId))
    ) {
      await this.markDocument(
        liveSource,
        fileId,
        'skipped',
        file ?? undefined,
        undefined,
        {
          preserveIndexed: true,
        },
      );
      incrementEmbeddingMetric('storageSkipped');
      return;
    }
    const existing = await this.deps.documents.findOne({
      sourceId: liveSource._id,
      externalDocumentId: fileId,
    });
    if (
      existing &&
      existing.status === 'indexed' &&
      (existing.contentVersion ?? '') === (file.contentVersion ?? '')
    ) {
      return;
    }
    const previousStatus = existing?.status;
    await this.markDocument(liveSource, fileId, 'extracting', file);
    const limits = storageExtractionLimits(this.deps.currentConfig());
    try {
      const bytes = await this.deps.getFileBytes(fileId, limits.maxFileBytes, {
        scope: liveSource.partitionSubject,
      });
      const current = await this.deps.sources.findOne({ _id: liveSource._id });
      if (!current || current.state !== 'ready') {
        if (existing && previousStatus === 'indexed') {
          await this.deps.documents.findByIdAndUpdate(existing._id, {
            status: 'indexed',
            contentVersion: existing.contentVersion,
          });
        }
        return;
      }
      const sniffed = sniffMimeType(bytes.data);
      const mime = assertAutomaticExtractable({
        declaredMime: file.mimeType ?? bytes.mimeType,
        sniffed,
      });
      const text = await extractByMime(bytes.data, mime, limits);
      const chunks = chunkExtractedText(
        text,
        {
          maxChunkBytes: limits.maxChunkBytes,
          maxChunksPerFile: limits.maxChunksPerFile,
          overlapBytes: limits.chunkOverlapBytes,
        },
        `file:${fileId}`,
      );
      if (!chunks.length) {
        await this.markDocument(current, fileId, 'skipped', file);
        incrementEmbeddingMetric('storageSkipped');
        return;
      }
      await this.deps.api.syncDocument(
        {
          sourceId: current._id,
          externalDocumentId: fileId,
          contentVersion: file.contentVersion,
          metadata: JSON.stringify(safeFileMetadata(file)),
          storageFileId: fileId,
          mimeType: mime,
          container: file.container,
          folder: file.folder,
          chunks: chunks.map(chunk => ({
            chunkKey: chunk.chunkKey,
            ordinal: chunk.ordinal,
            text: chunk.text,
            metadata: JSON.stringify(chunk.metadata),
          })),
        },
        { callerModule: 'embeddings' },
      );
      const saved = await this.deps.documents.findOne({
        sourceId: current._id,
        externalDocumentId: fileId,
      });
      if (saved) {
        await this.deps.documents.findByIdAndUpdate(saved._id, {
          container: file.container,
          folder: file.folder,
          storageFileId: fileId,
        });
      }
      incrementEmbeddingMetric('storageExtracted');
    } catch (err) {
      const current = await this.deps.sources.findOne({ _id: liveSource._id });
      if (!current || current.state !== 'ready') {
        if (existing && previousStatus === 'indexed') {
          await this.deps.documents.findByIdAndUpdate(existing._id, {
            status: 'indexed',
            contentVersion: existing.contentVersion,
          });
        }
        return;
      }
      await this.markDocument(current, fileId, 'failed', file, sanitizeErrorMessage(err));
      throw err;
    }
  }

  private async deleteFileDocument(source: EmbeddingSourceRecord, fileId: string) {
    const existing = await this.deps.documents.findOne({
      sourceId: source._id,
      externalDocumentId: fileId,
    });
    if (!existing) return;
    await this.deps.api.deleteDocument(
      { sourceId: source._id, externalDocumentId: fileId },
      { callerModule: 'embeddings' },
    );
  }

  private async markDocument(
    source: EmbeddingSourceRecord,
    fileId: string,
    status: EmbeddingDocumentRecord['status'],
    file?:
      | StorageFileRecord
      | {
          contentVersion?: string;
          container?: string;
          folder?: string;
          mimeType?: string;
        },
    error?: string,
    options?: { preserveIndexed?: boolean },
  ) {
    if (source.state !== 'ready' && !options?.preserveIndexed) {
      return;
    }
    const existing = await this.deps.documents.findOne({
      sourceId: source._id,
      externalDocumentId: fileId,
    });
    if (
      options?.preserveIndexed &&
      existing?.status === 'indexed' &&
      (status === 'skipped' || status === 'queued')
    ) {
      return;
    }
    const patch = {
      status,
      storageFileId: fileId,
      contentVersion:
        file && 'contentVersion' in file ? file.contentVersion : existing?.contentVersion,
      container: file && 'container' in file ? file.container : existing?.container,
      folder: file && 'folder' in file ? file.folder : existing?.folder,
      mimeType: file && 'mimeType' in file ? file.mimeType : existing?.mimeType,
      partitionSubject: source.partitionSubject,
      ...(error ? { metadata: { error } } : {}),
    };
    if (existing) {
      await this.deps.documents.findByIdAndUpdate(existing._id, patch);
      return;
    }
    if (source.state !== 'ready') return;
    try {
      await this.deps.documents.create({
        sourceId: source._id,
        externalDocumentId: fileId,
        ...patch,
      });
    } catch (err) {
      const raced = await this.deps.documents.findOne({
        sourceId: source._id,
        externalDocumentId: fileId,
      });
      if (!raced) throw err;
      await this.deps.documents.findByIdAndUpdate(raced._id, patch);
    }
  }

  private async isAuthorizedForFile(
    source: EmbeddingSourceRecord,
    fileId: string,
  ): Promise<boolean> {
    if (!this.deps.canReadFile) return true;
    return this.deps.canReadFile(fileId, source.partitionSubject);
  }

  private async matchingSources(file: {
    id: string;
    container?: string;
    folder?: string;
    mimeType?: string;
    uploadStatus?: string;
  }): Promise<EmbeddingSourceRecord[]> {
    const sources = await this.enabledStorageSources();
    const matched: EmbeddingSourceRecord[] = [];
    for (const source of sources) {
      const selectors = safeSelectors(source);
      if (!selectors || !fileMatchesSelectors(file, selectors)) continue;
      if (!(await this.isAuthorizedForFile(source, file.id))) continue;
      matched.push(source);
    }
    return matched;
  }

  private async enabledStorageSources(): Promise<EmbeddingSourceRecord[]> {
    return this.deps.sources.findMany({
      kind: 'conduit-storage',
      state: 'ready',
    });
  }

  private async deletableStorageSources(): Promise<EmbeddingSourceRecord[]> {
    return this.deps.sources.findMany({ kind: 'conduit-storage' });
  }

  private async requireStorageSource(id: string): Promise<EmbeddingSourceRecord> {
    const source = await this.deps.sources.findOne({ _id: id });
    if (!source || source.kind !== 'conduit-storage') {
      throw new GrpcError(
        status.NOT_FOUND,
        `Storage embedding source '${id}' was not found`,
      );
    }
    return source;
  }
}

function safeSelectors(source: EmbeddingSourceRecord): StorageSourceSelectors | null {
  try {
    return parseStorageSelectors(source.selectors);
  } catch {
    return null;
  }
}

function safeFileMetadata(file: StorageFileRecord): Record<string, unknown> {
  return {
    name: file.name,
    container: file.container,
    folder: file.folder,
    mimeType: file.mimeType,
    size: file.size,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function extractByMime(
  bytes: Buffer,
  mime: ReturnType<typeof assertAutomaticExtractable>,
  limits: ReturnType<typeof storageExtractionLimits>,
): Promise<string> {
  switch (mime) {
    case 'application/pdf':
      return extractPdfText(bytes, {
        maxPages: limits.maxPdfPages,
        maxExtractedBytes: limits.maxExtractedBytes,
        timeoutMs: limits.extractTimeoutMs,
      });
    case 'application/json':
      return extractJsonText(bytes, limits.maxExtractedBytes);
    case 'text/csv':
      return extractCsvText(bytes, limits.maxExtractedBytes);
    case 'text/markdown':
    case 'text/plain':
      return extractUtf8Text(bytes, limits.maxExtractedBytes);
    default: {
      const _never: never = mime;
      return _never;
    }
  }
}
