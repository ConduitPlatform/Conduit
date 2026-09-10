import type { Config } from '../config/index.js';

export interface StorageExtractionLimits {
  maxFileBytes: number;
  maxExtractedBytes: number;
  maxPdfPages: number;
  extractTimeoutMs: number;
  maxChunksPerFile: number;
  chunkOverlapBytes: number;
  maxChunkBytes: number;
  queueConcurrency: number;
  queueAttempts: number;
}

export function storageExtractionLimits(config?: Config): StorageExtractionLimits {
  const extraction = (config?.storageExtraction ??
    {}) as Partial<StorageExtractionLimits>;
  const security = (config?.security ?? {}) as {
    maxChunksPerDocument?: number;
    maxChunkTextBytes?: number;
    maxEmbedInputBytes?: number;
  };
  return {
    maxFileBytes: extraction.maxFileBytes ?? 8 * 1024 * 1024,
    maxExtractedBytes: extraction.maxExtractedBytes ?? 2 * 1024 * 1024,
    maxPdfPages: extraction.maxPdfPages ?? 50,
    extractTimeoutMs: extraction.extractTimeoutMs ?? 15_000,
    maxChunksPerFile: extraction.maxChunksPerFile ?? security.maxChunksPerDocument ?? 256,
    chunkOverlapBytes: extraction.chunkOverlapBytes ?? 256,
    maxChunkBytes: security.maxChunkTextBytes ?? security.maxEmbedInputBytes ?? 32 * 1024,
    queueConcurrency: extraction.queueConcurrency ?? 1,
    queueAttempts: extraction.queueAttempts ?? 5,
  };
}
