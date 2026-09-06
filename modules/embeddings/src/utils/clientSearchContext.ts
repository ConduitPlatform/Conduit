import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const CLIENT_SEMANTIC_SEARCH_MAX_LIMIT = 50;

export function clientSearchSubject(context?: {
  user?: { _id?: unknown };
  scope?: unknown;
}): { userId?: string; scope?: string } {
  const userId = context?.user?._id;
  const scope = context?.scope;
  return {
    ...(typeof userId === 'string' && userId.length > 0 ? { userId } : {}),
    ...(typeof scope === 'string' && scope.length > 0 ? { scope } : {}),
  };
}

export function assertClientSearchSubject(subject: { userId?: string; scope?: string }): {
  userId?: string;
  scope?: string;
} {
  if (!subject.userId && !subject.scope) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Semantic search requires an authenticated user or scope from router context',
    );
  }
  return subject;
}

export function clampClientSearchLimit(limit?: number): number | undefined {
  if (limit === undefined || limit === null) return undefined;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'limit must be a positive integer');
  }
  return Math.min(limit, CLIENT_SEMANTIC_SEARCH_MAX_LIMIT);
}
