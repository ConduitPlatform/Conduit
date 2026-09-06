import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const VECTOR_SEARCH_OPERATOR_MODULES = ['database', 'core', 'embeddings'] as const;

export function resolveAdminOperatorContext(args: {
  requested?: boolean;
  callerModule?: string;
  operatorModules?: readonly string[];
}): boolean {
  if (!args.requested) return false;
  const operators = args.operatorModules ?? VECTOR_SEARCH_OPERATOR_MODULES;
  if (!args.callerModule || !operators.includes(args.callerModule)) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      'Admin operator context is not allowed for this caller',
    );
  }
  return true;
}

export function assertVectorSearchAccess(args: {
  authzEnabled: boolean;
  userId?: string;
  scope?: string;
  adminOperator?: boolean;
}): void {
  if (!args.authzEnabled) return;
  if (args.userId || args.scope || args.adminOperator) return;
  throw new GrpcError(
    status.PERMISSION_DENIED,
    'Vector search on authorization-enabled schemas requires a subject, scope, or admin operator context',
  );
}
