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

export const CLIENT_SEARCH_FORBIDDEN_FIELDS = [
  'queryVector',
  'userId',
  'adminOperator',
  'partitionSubject',
] as const;

export function assertClientSearchOverrides(params: Record<string, unknown>): void {
  for (const field of CLIENT_SEARCH_FORBIDDEN_FIELDS) {
    const value = params[field];
    if (value !== undefined && value !== null && value !== '') {
      throw new GrpcError(status.INVALID_ARGUMENT, `Client search cannot set ${field}`);
    }
  }
}

export function resolveClientSearchScope(args: {
  contextScope?: string;
  requestScope?: string;
}): string | undefined {
  const context = args.contextScope?.trim() ?? '';
  const requested = args.requestScope?.trim() ?? '';
  if (requested && context && requested !== context) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Requested scope does not match router context scope',
    );
  }
  return requested || context || undefined;
}

export function clampClientSearchLimit(limit?: number): number | undefined {
  if (limit === undefined || limit === null) return undefined;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'limit must be a positive integer');
  }
  return Math.min(limit, CLIENT_SEMANTIC_SEARCH_MAX_LIMIT);
}
