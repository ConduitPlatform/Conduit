import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

export const EMBEDDING_METRICS = {
  generated: 'generated_embeddings_total',
  failed: 'failed_embeddings_total',
  skipped: 'skipped_embeddings_total',
  retried: 'retried_embeddings_total',
  backfill: 'embedding_backfill_jobs_total',
  malformedEvents: 'malformed_embedding_events_total',
  malformedJobs: 'malformed_embedding_jobs_total',
  storageExtracted: 'storage_extracted_total',
  storageSkipped: 'storage_skipped_total',
  storageFailed: 'storage_extraction_failed_total',
} as const;

export type EmbeddingMetric = keyof typeof EMBEDDING_METRICS;

export function incrementEmbeddingMetric(
  metric: EmbeddingMetric,
  amount: number = 1,
): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  ConduitGrpcSdk.Metrics?.increment(EMBEDDING_METRICS[metric], amount);
}
