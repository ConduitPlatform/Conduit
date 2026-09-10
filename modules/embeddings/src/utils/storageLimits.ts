import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
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

export const DEFAULT_STORAGE_EXTRACTION_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxExtractedBytes: 2 * 1024 * 1024,
  maxPdfPages: 50,
  extractTimeoutMs: 15_000,
  maxChunksPerFile: 256,
  chunkOverlapBytes: 256,
  maxChunkBytes: 32 * 1024,
  queueConcurrency: 1,
  queueAttempts: 5,
} as const satisfies StorageExtractionLimits;

const POSITIVE_QUEUE_PATHS = [
  'concurrency',
  'attempts',
  'maxBatchSize',
  'drainTimeoutMs',
] as const;

const POSITIVE_SECURITY_PATHS = [
  'maxMutationEventIds',
  'embedTimeoutMs',
  'maxEmbedInputBytes',
  'maxEmbedResponseBytes',
  'maxIngestBatchSize',
  'maxChunksPerDocument',
  'maxChunkTextBytes',
  'maxMetadataBytes',
  'maxReferenceBytes',
  'sourceSearchMaxLimit',
] as const;

const POSITIVE_EXTRACTION_PATHS = [
  'maxFileBytes',
  'maxExtractedBytes',
  'maxPdfPages',
  'extractTimeoutMs',
  'maxChunksPerFile',
  'queueConcurrency',
  'queueAttempts',
] as const;

export function storageExtractionLimits(config?: Config): StorageExtractionLimits {
  const extraction = config?.storageExtraction;
  const security = config?.security;
  const maxChunksPerDocument =
    security?.maxChunksPerDocument ?? DEFAULT_STORAGE_EXTRACTION_LIMITS.maxChunksPerFile;
  const limits: StorageExtractionLimits = {
    maxFileBytes:
      extraction?.maxFileBytes ?? DEFAULT_STORAGE_EXTRACTION_LIMITS.maxFileBytes,
    maxExtractedBytes:
      extraction?.maxExtractedBytes ??
      DEFAULT_STORAGE_EXTRACTION_LIMITS.maxExtractedBytes,
    maxPdfPages: extraction?.maxPdfPages ?? DEFAULT_STORAGE_EXTRACTION_LIMITS.maxPdfPages,
    extractTimeoutMs:
      extraction?.extractTimeoutMs ?? DEFAULT_STORAGE_EXTRACTION_LIMITS.extractTimeoutMs,
    maxChunksPerFile: Math.min(
      extraction?.maxChunksPerFile ?? maxChunksPerDocument,
      maxChunksPerDocument,
    ),
    chunkOverlapBytes:
      extraction?.chunkOverlapBytes ??
      DEFAULT_STORAGE_EXTRACTION_LIMITS.chunkOverlapBytes,
    maxChunkBytes:
      security?.maxChunkTextBytes ??
      security?.maxEmbedInputBytes ??
      DEFAULT_STORAGE_EXTRACTION_LIMITS.maxChunkBytes,
    queueConcurrency:
      extraction?.queueConcurrency ?? DEFAULT_STORAGE_EXTRACTION_LIMITS.queueConcurrency,
    queueAttempts:
      extraction?.queueAttempts ?? DEFAULT_STORAGE_EXTRACTION_LIMITS.queueAttempts,
  };
  validateStorageExtractionLimits(limits);
  return limits;
}

export function validateOperationalLimits(config: {
  queue?: Record<string, unknown>;
  security?: Record<string, unknown>;
  storageExtraction?: Record<string, unknown>;
}): void {
  if (config.queue) {
    for (const key of POSITIVE_QUEUE_PATHS) {
      assertPositiveInteger(config.queue[key], `queue.${key}`);
    }
  }
  if (config.security) {
    for (const key of POSITIVE_SECURITY_PATHS) {
      assertPositiveInteger(config.security[key], `security.${key}`);
    }
    assertTrustedIngestModules(config.security.trustedIngestModules);
  }
  if (config.storageExtraction) {
    for (const key of POSITIVE_EXTRACTION_PATHS) {
      assertPositiveInteger(config.storageExtraction[key], `storageExtraction.${key}`);
    }
    assertNonNegativeInteger(
      config.storageExtraction.chunkOverlapBytes,
      'storageExtraction.chunkOverlapBytes',
    );
  }
}

function validateStorageExtractionLimits(limits: StorageExtractionLimits): void {
  assertPositiveInteger(limits.maxFileBytes, 'storageExtraction.maxFileBytes');
  assertPositiveInteger(limits.maxExtractedBytes, 'storageExtraction.maxExtractedBytes');
  assertPositiveInteger(limits.maxPdfPages, 'storageExtraction.maxPdfPages');
  assertPositiveInteger(limits.extractTimeoutMs, 'storageExtraction.extractTimeoutMs');
  assertPositiveInteger(limits.maxChunksPerFile, 'storageExtraction.maxChunksPerFile');
  assertNonNegativeInteger(
    limits.chunkOverlapBytes,
    'storageExtraction.chunkOverlapBytes',
  );
  assertPositiveInteger(limits.maxChunkBytes, 'security.maxChunkTextBytes');
  assertPositiveInteger(limits.queueConcurrency, 'storageExtraction.queueConcurrency');
  assertPositiveInteger(limits.queueAttempts, 'storageExtraction.queueAttempts');
}

function assertPositiveInteger(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new GrpcError(status.INVALID_ARGUMENT, `${path} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `${path} must be a non-negative integer`,
    );
  }
}

function assertTrustedIngestModules(value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'security.trustedIngestModules must be an array of module names',
    );
  }
  for (const item of value) {
    if (typeof item !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(item)) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'security.trustedIngestModules entries must be module names',
      );
    }
  }
}
