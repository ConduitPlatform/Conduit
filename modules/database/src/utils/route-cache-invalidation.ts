import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

/** Must match ROUTE_CACHE_INVALIDATION_TOPIC in @conduitplatform/hermes */
const ROUTE_CACHE_INVALIDATION_TOPIC = 'route-cache-invalidation';

const DATABASE_MODULE_PREFIX = '/database';

export interface RouteCacheInvalidationMessage {
  paths?: string[];
  prefixes?: string[];
}

/** Escape Redis SCAN glob metacharacters in a path segment. */
export function escapeRedisScanGlob(segment: string): string {
  return segment.replace(/[[\]?*]/g, '\\$&');
}

export function publishRouteCacheInvalidation(
  grpcSdk: ConduitGrpcSdk,
  message: RouteCacheInvalidationMessage,
): void {
  if (!grpcSdk.bus) return;
  grpcSdk.bus.publish(ROUTE_CACHE_INVALIDATION_TOPIC, JSON.stringify(message));
}

export function invalidateCachesAfterSchemaMutation(
  grpcSdk: ConduitGrpcSdk,
  schemaName: string,
): void {
  publishRouteCacheInvalidation(grpcSdk, {
    prefixes: [
      `${DATABASE_MODULE_PREFIX}/function/`,
      `${DATABASE_MODULE_PREFIX}/${escapeRedisScanGlob(schemaName)}`,
    ],
  });
}
