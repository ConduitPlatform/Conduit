import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

/** Record chunk count and duration for authorized bulk write paths (Mongo + Sequelize). */
export function recordAuthorizedBulkOperationMetrics(args: {
  operation: string;
  schemaName: string;
  chunkCount: number;
  durationMs: number;
}): void {
  const labels = { operation: args.operation, schema: args.schemaName };
  ConduitGrpcSdk.Metrics?.increment(
    'database_authorized_bulk_chunks_total',
    args.chunkCount,
    labels,
  );
  ConduitGrpcSdk.Metrics?.observe(
    'database_authorized_bulk_duration_ms',
    args.durationMs,
    labels,
  );
}

/** Record when CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS aborts a bulk operation. */
export function recordAuthorizedBulkCapErrorMetrics(args: {
  operation: string;
  schemaName: string;
}): void {
  ConduitGrpcSdk.Metrics?.increment(
    'database_authorized_bulk_max_total_ids_errors_total',
    1,
    { operation: args.operation, schema: args.schemaName },
  );
}
