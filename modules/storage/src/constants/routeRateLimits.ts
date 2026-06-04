import type { RateLimitOptions } from '@conduitplatform/grpc-sdk';

export const STORAGE_WRITE: RateLimitOptions = {
  maxRequests: 60,
  resetInterval: 3600,
};
