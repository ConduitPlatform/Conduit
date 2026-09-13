import {
  ConduitGrpcSdk,
  ConduitRouteReturnDefinition,
  type Indexable,
  ParsedSocketRequest,
  TYPE,
  UnparsedSocketResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { RoutingManager } from '@conduitplatform/module-tools';
import {
  assertSchemaAvailable,
  canReadDocument,
  optionalDocumentId,
  parseSubscribeRequest,
  RealtimeSubscriptionError,
  requireSchemaName,
  type AuthorizationSdk,
  type SchemaLookup,
} from './authorize.js';
import { authorizedDocumentRoom, documentRoom, schemaRoom } from './rooms.js';
import type { RealtimeSubscriptionTracker } from './subscriptions.js';
import {
  authorizedSubsFromContext,
  isRecoverableDisconnect,
  persistAuthorizedSubOnContext,
  recoveredRoomsFromRequest,
  removeAuthorizedSubFromContext,
  restoreAuthorizedSubscriptions,
} from './recovery.js';

type SocketMode = 'client' | 'admin';

type RealtimeSocketOptions = {
  mode: SocketMode;
  grpcSdk: ConduitGrpcSdk;
  schemaLookup: SchemaLookup;
  subscriptions: RealtimeSubscriptionTracker;
  isGloballyEnabled: () => boolean;
};

export function registerDatabaseRealtimeSocket(
  routingManager: RoutingManager,
  options: RealtimeSocketOptions,
) {
  const handlers = createSocketHandlers(options);
  routingManager.socket(
    {
      path: '/',
      middlewares: options.mode === 'client' ? ['authMiddleware'] : undefined,
    },
    {
      connect: { handler: handlers.connect },
      disconnect: { handler: handlers.disconnect },
      recovered: { handler: handlers.recovered },
      subscribe: {
        params: [TYPE.JSON],
        handler: handlers.subscribe,
        returnType: new ConduitRouteReturnDefinition('DatabaseRealtimeSubscribe', {
          rooms: [TYPE.String],
        }),
      },
      unsubscribe: {
        params: [TYPE.JSON],
        handler: handlers.unsubscribe,
        returnType: new ConduitRouteReturnDefinition('DatabaseRealtimeUnsubscribe', {
          rooms: [TYPE.String],
        }),
      },
    },
  );
}

export function createSocketHandlers(options: RealtimeSocketOptions) {
  return {
    connect: async (): Promise<UnparsedSocketResponse> => {
      return { event: 'connected', data: { ok: true } };
    },
    disconnect: async (call: ParsedSocketRequest): Promise<UnparsedSocketResponse> => {
      const reason = call.request.params?.[0];
      if (!isRecoverableDisconnect(reason)) {
        await options.subscriptions.disconnect(call.request.socketId);
      }
      return { event: 'disconnected', data: { ok: true } };
    },
    recovered: async (call: ParsedSocketRequest): Promise<UnparsedSocketResponse> => {
      const { leaveRooms } = await restoreAuthorizedSubscriptions({
        socketId: call.request.socketId,
        rooms: recoveredRoomsFromRequest(call),
        contextSubs: authorizedSubsFromContext(call.request.context as Indexable),
        subscriptions: options.subscriptions,
        grpcSdk: options.grpcSdk as unknown as AuthorizationSdk,
        canRead: canReadDocument,
      });
      if (leaveRooms.length > 0) {
        return { event: 'leave-room', rooms: leaveRooms };
      }
      return { event: 'join-room', rooms: [] };
    },
    subscribe: async (call: ParsedSocketRequest): Promise<UnparsedSocketResponse> => {
      const rooms = await resolveSubscription(call, options, 'join');
      return { event: 'join-room', rooms };
    },
    unsubscribe: async (call: ParsedSocketRequest): Promise<UnparsedSocketResponse> => {
      const rooms = await resolveSubscription(call, options, 'leave');
      return { event: 'leave-room', rooms };
    },
  };
}

async function resolveSubscription(
  call: ParsedSocketRequest,
  options: RealtimeSocketOptions,
  action: 'join' | 'leave',
): Promise<string[]> {
  if (!options.isGloballyEnabled()) {
    throw new RealtimeSubscriptionError(
      status.FAILED_PRECONDITION,
      'Live updates are disabled',
    );
  }
  const payload = parseSubscribeRequest(call.request.params ?? []);
  const schemaName = requireSchemaName(payload.schema);
  const documentId = optionalDocumentId(payload.documentId);
  const meta = assertSchemaAvailable(
    options.schemaLookup,
    schemaName,
    options.mode === 'client',
  );

  if (options.mode === 'admin') {
    if (documentId) return [documentRoom(schemaName, documentId)];
    return [schemaRoom(schemaName)];
  }

  const userId = call.request.context?.user?._id;
  if (!userId) {
    throw new RealtimeSubscriptionError(
      status.UNAUTHENTICATED,
      'Authentication required',
    );
  }

  if (meta.authorizationEnabled) {
    if (!documentId) {
      throw new RealtimeSubscriptionError(
        status.PERMISSION_DENIED,
        'Document ID is required for authorized schemas',
      );
    }
    const allowed = await canReadDocument(
      options.grpcSdk as unknown as AuthorizationSdk,
      schemaName,
      documentId,
      userId,
    );
    if (!allowed) {
      throw new RealtimeSubscriptionError(
        status.PERMISSION_DENIED,
        'Read permission denied',
      );
    }
    if (action === 'join') {
      await options.subscriptions.addAuthorizedDocument(
        call.request.socketId,
        schemaName,
        documentId,
        userId,
      );
      persistAuthorizedSubOnContext(
        call.request.context as Indexable,
        schemaName,
        documentId,
        userId,
      );
    } else {
      await options.subscriptions.removeAuthorizedDocument(
        call.request.socketId,
        schemaName,
        documentId,
        userId,
      );
      removeAuthorizedSubFromContext(
        call.request.context as Indexable,
        schemaName,
        documentId,
        userId,
      );
    }
    return [authorizedDocumentRoom(schemaName, documentId, userId)];
  }

  if (documentId) return [documentRoom(schemaName, documentId)];
  return [schemaRoom(schemaName)];
}
