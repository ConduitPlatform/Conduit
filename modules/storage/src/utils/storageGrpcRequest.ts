import { createParsedRouterRequest } from '@conduitplatform/module-tools';
import type { Context, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';

const UNTRUSTED_SCOPE_ONLY_CALLERS = new Set(['router', 'client']);

export function nonEmptyAuthzString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function callerModuleName(metadata?: {
  get(key: string): Array<string | Buffer>;
}): string | undefined {
  const value = metadata?.get('module-name')?.[0];
  if (typeof value === 'string') return nonEmptyAuthzString(value);
  if (Buffer.isBuffer(value) && value.length > 0) {
    return nonEmptyAuthzString(value.toString());
  }
  return undefined;
}

export function isUntrustedScopeOnlyCaller(callerModule?: string): boolean {
  return UNTRUSTED_SCOPE_ONLY_CALLERS.has((callerModule ?? '').toLowerCase());
}

export function storageGrpcAuthz(request: { userId?: string; scope?: string }) {
  return {
    userId: nonEmptyAuthzString(request.userId),
    scope: nonEmptyAuthzString(request.scope),
  };
}

export function storageGrpcContext(args: {
  userId?: string;
  scope?: string;
  callerModule?: string;
}): Context {
  const userId = nonEmptyAuthzString(args.userId);
  const scope = nonEmptyAuthzString(args.scope);
  const callerModule = nonEmptyAuthzString(args.callerModule);
  return {
    ...(userId ? { user: { _id: userId } } : {}),
    ...(scope ? { scope } : {}),
    ...(callerModule ? { callerModule } : {}),
  };
}

export function buildStorageGrpcRequest(
  call: {
    request: { userId?: string; scope?: string };
    metadata?: { get(key: string): Array<string | Buffer> };
  },
  extraQuery?: Record<string, unknown>,
): { request: ParsedRouterRequest; useClientHandlers: boolean } {
  const { userId, scope } = storageGrpcAuthz(call.request);
  const context = storageGrpcContext({
    userId,
    scope,
    callerModule: callerModuleName(call.metadata),
  });
  return {
    useClientHandlers: Boolean(userId || scope),
    request: createParsedRouterRequest(
      call.request,
      undefined,
      { ...(scope ? { scope } : {}), ...extraQuery },
      undefined,
      undefined,
      undefined,
      context,
    ),
  };
}
