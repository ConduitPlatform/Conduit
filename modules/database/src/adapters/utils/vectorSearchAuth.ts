import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';

export const VECTOR_SEARCH_OPERATOR_MODULES = ['database', 'core', 'embeddings'] as const;

export function resolveAdminOperatorContext(args: {
  requested?: boolean;
  callerModule?: string;
  operatorModules?: readonly string[];
}): boolean {
  if (!args.requested) return false;
  const operators = args.operatorModules ?? VECTOR_SEARCH_OPERATOR_MODULES;
  if (!args.callerModule || !operators.includes(args.callerModule)) {
    throw new ModuleError({
      ...errors.VECTOR_SEARCH_NOT_PERMITTED,
      message: 'Admin operator context is not allowed for this caller',
    });
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
  throw new ModuleError({
    ...errors.VECTOR_SEARCH_NOT_PERMITTED,
    message:
      'Vector search on authorization-enabled schemas requires a subject, scope, or admin operator context',
  });
}

export async function authorizeBoundedVectorCandidates(args: {
  authzEnabled: boolean;
  adminOperator?: boolean;
  candidateIds: Array<string | { toString(): string }>;
  lookupAuthorizedIds: (ids: string[]) => Promise<string[]>;
}): Promise<Set<string>> {
  const ids = args.candidateIds.map(id => String(id)).filter(Boolean);
  if (!ids.length) return new Set();
  if (!args.authzEnabled || args.adminOperator) {
    return new Set(ids);
  }
  const authorized = await args.lookupAuthorizedIds(ids);
  return new Set(authorized.map(id => String(id)));
}

export function applyBoundedVectorAuthorization<
  T extends { _id?: unknown; id?: unknown },
>(documents: T[], authorizedIds: Set<string>, limit: number): T[] {
  const next: T[] = [];
  for (const document of documents) {
    const id = document._id ?? document.id;
    if (id === undefined || id === null) continue;
    if (!authorizedIds.has(String(id))) continue;
    next.push(document);
    if (next.length >= limit) break;
  }
  return next;
}
