import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitSocket, ConduitSocketEvent } from '@conduitplatform/hermes';
import {
  EVENTS_NAMESPACE,
  MAX_SUBSCRIBE_PER_MINUTE,
} from './constants.js';
import { EventRelayManager } from './EventRelayManager.js';
import { eventRelayRoom } from './rooms.js';
import { validateResourceId } from './validation.js';
import { authorizeRelaySubscription, toSubscriptionError } from './authorize.js';
import {
  clearSocketSubscriptionTracking,
  removeSubscription,
  subscriptionsForUser,
  trackSubscription,
  _clearEventRelaySubscriptionStateForTests,
} from './subscriptions.js';

const subscribeTimestamps = new Map<string, number[]>();

export function createEventsSocket(
  grpcSdk: ConduitGrpcSdk,
  manager: EventRelayManager,
): ConduitSocket {
  const events = new Map<string, ConduitSocketEvent>();

  events.set('connect', {
    name: 'connect',
    handler: async () => ({ event: 'join-room', rooms: [] }),
  });

  events.set('disconnect', {
    name: 'disconnect',
    handler: async request => {
      clearSocketSubscriptionTracking(request.socketId);
      subscribeTimestamps.delete(request.socketId);
      return { event: 'leave-room', rooms: [] };
    },
  });

  events.set('subscribe', {
    name: 'subscribe',
    params: [TYPE.String, TYPE.String],
    handler: async request => {
      assertSubscribeRateLimit(request.socketId);
      const userId = request.context?.user?._id as string | undefined;
      if (!userId) {
        throw new GrpcError(status.UNAUTHENTICATED, 'Authentication required');
      }
      const [relayId, resourceId] = request.params ?? [];
      const room = await authorizeOrThrow(grpcSdk, manager, userId, relayId, resourceId);
      try {
        trackSubscription(
          request.socketId,
          userId,
          String(relayId),
          validateResourceId(resourceId),
        );
      } catch (err) {
        throw new GrpcError(
          status.RESOURCE_EXHAUSTED,
          err instanceof Error ? err.message : 'Subscription limit exceeded',
        );
      }
      return { event: 'join-room', rooms: [room] };
    },
  });

  events.set('unsubscribe', {
    name: 'unsubscribe',
    params: [TYPE.String, TYPE.String],
    handler: async request => {
      const userId = request.context?.user?._id as string | undefined;
      const [relayId, resourceId] = request.params ?? [];
      if (typeof relayId !== 'string' || relayId.trim() === '') {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Relay ID is required');
      }
      try {
        const validatedResourceId = validateResourceId(resourceId);
        removeSubscription(request.socketId, userId, relayId, validatedResourceId);
        return {
          event: 'leave-room',
          rooms: [eventRelayRoom(relayId, validatedResourceId)],
        };
      } catch (err) {
        throw toGrpcError(err);
      }
    },
  });

  return new ConduitSocket(
    {
      path: EVENTS_NAMESPACE,
      name: 'eventRelays',
      description: 'Declarative bus-to-socket event relays',
      middlewares: ['authMiddleware'],
      onRecovered: async request =>
        reauthorizeRecoveredSubscriptions(grpcSdk, manager, request),
    },
    events,
  );
}

async function reauthorizeRecoveredSubscriptions(
  grpcSdk: ConduitGrpcSdk,
  manager: EventRelayManager,
  request: { socketId: string; context?: { user?: { _id?: string } } },
) {
  const userId = request.context?.user?._id as string | undefined;
  if (!userId) {
    return { event: 'leave-room' as const, rooms: [] };
  }
  const subs = subscriptionsForUser(userId);
  const keepRooms: string[] = [];
  for (const sub of subs) {
    try {
      const room = await authorizeRelaySubscription(
        grpcSdk,
        manager,
        userId,
        sub.relayId,
        sub.resourceId,
        () => {
          ConduitGrpcSdk.Metrics?.increment('event_relay_subscriptions_denied_total');
        },
      );
      keepRooms.push(room);
      trackSubscription(request.socketId, userId, sub.relayId, sub.resourceId);
    } catch {
      removeSubscription(request.socketId, userId, sub.relayId, sub.resourceId);
      ConduitGrpcSdk.Metrics?.increment('event_relay_subscriptions_denied_total');
    }
  }
  const leaveRooms = subs
    .map(sub => eventRelayRoom(sub.relayId, sub.resourceId))
    .filter(room => !keepRooms.includes(room));
  if (leaveRooms.length > 0) {
    return { event: 'leave-room' as const, rooms: leaveRooms };
  }
  return { event: 'join-room' as const, rooms: [] };
}

function assertSubscribeRateLimit(socketId: string): void {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (subscribeTimestamps.get(socketId) ?? []).filter(
    t => t >= windowStart,
  );
  if (timestamps.length >= MAX_SUBSCRIBE_PER_MINUTE) {
    throw new GrpcError(status.RESOURCE_EXHAUSTED, 'Subscribe rate limit exceeded');
  }
  timestamps.push(now);
  subscribeTimestamps.set(socketId, timestamps);
}

async function authorizeOrThrow(
  grpcSdk: ConduitGrpcSdk,
  manager: EventRelayManager,
  userId: string | undefined,
  relayId: unknown,
  resourceId: unknown,
): Promise<string> {
  try {
    return await authorizeRelaySubscription(
      grpcSdk,
      manager,
      userId,
      relayId,
      resourceId,
      () => {
        ConduitGrpcSdk.Metrics?.increment('event_relay_subscriptions_denied_total');
      },
    );
  } catch (err) {
    throw toGrpcError(err);
  }
}

function toGrpcError(err: unknown): GrpcError {
  const mapped = toSubscriptionError(err);
  return new GrpcError(mapped.code, mapped.message);
}

export { authorizeRelaySubscription } from './authorize.js';

/** @internal test helper */
export function _clearEventRelaySocketStateForTests(): void {
  _clearEventRelaySubscriptionStateForTests();
  subscribeTimestamps.clear();
}
