import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

/** Must match ROUTE_CACHE_INVALIDATION_TOPIC in @conduitplatform/hermes */
const ROUTE_CACHE_INVALIDATION_TOPIC = 'route-cache-invalidation';

const DATABASE_MODULE_PREFIX = '/database';

export interface RouteCacheInvalidationMessage {
  paths?: string[];
  prefixes?: string[];
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
      `${DATABASE_MODULE_PREFIX}/${schemaName}`,
    ],
  });
}
