import type { Indexable, ParsedSocketRequest } from '@conduitplatform/grpc-sdk';
import type { AuthorizationSdk } from './authorize.js';
import { authorizedDocumentRoom, parseAuthorizedDocumentRoom } from './rooms.js';
import type { RealtimeSubscriptionTracker } from './subscriptions.js';

const RECOVERABLE_DISCONNECT = new Set([
  'ping timeout',
  'transport close',
  'transport error',
]);

const CONTEXT_KEY = 'databaseSubs';

export type AuthorizedSub = {
  schema: string;
  documentId: string;
  userId: string;
};

export function isRecoverableDisconnect(reason: unknown): boolean {
  return typeof reason === 'string' && RECOVERABLE_DISCONNECT.has(reason);
}

export function authorizedSubsFromContext(
  context: Indexable | undefined,
): AuthorizedSub[] {
  if (!context) return [];
  const raw = context[CONTEXT_KEY];
  if (!Array.isArray(raw)) return [];
  const subs: AuthorizedSub[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as AuthorizedSub).schema === 'string' &&
      typeof (item as AuthorizedSub).documentId === 'string' &&
      typeof (item as AuthorizedSub).userId === 'string'
    ) {
      subs.push({
        schema: (item as AuthorizedSub).schema,
        documentId: (item as AuthorizedSub).documentId,
        userId: (item as AuthorizedSub).userId,
      });
    }
  }
  return subs;
}

export function persistAuthorizedSubOnContext(
  context: Indexable | undefined,
  schema: string,
  documentId: string,
  userId: string,
): void {
  if (!context) return;
  const next = authorizedSubsFromContext(context).filter(
    sub =>
      !(sub.schema === schema && sub.documentId === documentId && sub.userId === userId),
  );
  next.push({ schema, documentId, userId });
  context[CONTEXT_KEY] = next;
}

export function removeAuthorizedSubFromContext(
  context: Indexable | undefined,
  schema: string,
  documentId: string,
  userId: string,
): void {
  if (!context) return;
  const next = authorizedSubsFromContext(context).filter(
    sub =>
      !(sub.schema === schema && sub.documentId === documentId && sub.userId === userId),
  );
  if (next.length === 0) {
    delete context[CONTEXT_KEY];
  } else {
    context[CONTEXT_KEY] = next;
  }
}

export function recoveredRoomsFromRequest(call: ParsedSocketRequest): string[] {
  const params = call.request.params ?? [];
  if (params.every(item => typeof item === 'string')) {
    return params as string[];
  }
  return [];
}

export async function restoreAuthorizedSubscriptions(options: {
  socketId: string;
  rooms: string[];
  contextSubs: AuthorizedSub[];
  subscriptions: RealtimeSubscriptionTracker;
  grpcSdk: AuthorizationSdk;
  canRead: (
    grpcSdk: AuthorizationSdk,
    schema: string,
    documentId: string,
    userId: string,
  ) => Promise<boolean>;
}): Promise<{ leaveRooms: string[] }> {
  const seen = new Set<string>();
  const subs: AuthorizedSub[] = [];
  for (const room of options.rooms) {
    const parsed = parseAuthorizedDocumentRoom(room);
    if (!parsed) continue;
    const key = `${parsed.schema}:${parsed.documentId}:${parsed.userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    subs.push(parsed);
  }
  for (const sub of options.contextSubs) {
    const key = `${sub.schema}:${sub.documentId}:${sub.userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    subs.push(sub);
  }

  const leaveRooms: string[] = [];
  for (const sub of subs) {
    const allowed = await options.canRead(
      options.grpcSdk,
      sub.schema,
      sub.documentId,
      sub.userId,
    );
    const room = authorizedDocumentRoom(sub.schema, sub.documentId, sub.userId);
    if (!allowed) {
      await options.subscriptions.removeAuthorizedDocument(
        options.socketId,
        sub.schema,
        sub.documentId,
        sub.userId,
      );
      leaveRooms.push(room);
      continue;
    }
    await options.subscriptions.addAuthorizedDocument(
      options.socketId,
      sub.schema,
      sub.documentId,
      sub.userId,
    );
  }
  return { leaveRooms };
}
