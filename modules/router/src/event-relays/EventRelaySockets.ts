import { ConduitGrpcSdk, TYPE } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { ConduitSocket, ConduitSocketEvent } from '@conduitplatform/hermes';
import { EVENTS_NAMESPACE, MAX_SUBSCRIBE_PER_MINUTE } from './constants.js';
import { contextUserId } from './userId.js';
import { EventRelayManager } from './EventRelayManager.js';
import { eventRelayRoom } from './rooms.js';
import { validateResourceId } from './validation.js';
import { authorizeRelaySubscription, toSubscriptionError } from './authorize.js';
import { reauthorizeRecoveredSubscriptions } from './recovery.js';
import {
  releaseSocketSubscriptions,
  removeSubscription,
  trackSubscription,
  _clearEventRelaySubscriptionStateForTests,
} from './subscriptions.js';
import {
  persistRelaySubscriptionOnContext,
  removeRelaySubscriptionFromContext,
} from './relaySocketData.js';

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
      const userId = contextUserId(request.context);
      releaseSocketSubscriptions(request.socketId, userId);
      subscribeTimestamps.delete(request.socketId);
      return { event: 'leave-room', rooms: [] };
    },
  });

  events.set('subscribe', {
    name: 'subscribe',
    params: [TYPE.String, TYPE.String],
    handler: async request => {
      assertSubscribeRateLimit(request.socketId);
      const userId = contextUserId(request.context);
      if (!userId) {
        throw new ModuleError(errors.EVENT_RELAY_AUTH_REQUIRED);
      }
      const [relayId, resourceId] = request.params ?? [];
      let validatedResourceId: string;
      try {
        validatedResourceId = validateResourceId(resourceId);
      } catch (err) {
        throw toModuleError(err);
      }
      const room = await authorizeOrThrow(grpcSdk, manager, userId, relayId, resourceId);
      try {
        trackSubscription(request.socketId, userId, String(relayId), validatedResourceId);
        persistRelaySubscriptionOnContext(
          request.context,
          String(relayId),
          validatedResourceId,
        );
      } catch (err) {
        throw ModuleError.from(err, errors.RELAY_SUBSCRIPTION_LIMIT_EXCEEDED);
      }
      return { event: 'join-room', rooms: [room] };
    },
  });

  events.set('unsubscribe', {
    name: 'unsubscribe',
    params: [TYPE.String, TYPE.String],
    handler: async request => {
      const userId = contextUserId(request.context);
      const [relayId, resourceId] = request.params ?? [];
      if (typeof relayId !== 'string' || relayId.trim() === '') {
        throw new ModuleError(errors.RELAY_ID_REQUIRED);
      }
      try {
        const validatedResourceId = validateResourceId(resourceId);
        removeSubscription(request.socketId, userId, relayId, validatedResourceId);
        removeRelaySubscriptionFromContext(request.context, relayId, validatedResourceId);
        return {
          event: 'leave-room',
          rooms: [eventRelayRoom(relayId, validatedResourceId)],
        };
      } catch (err) {
        throw toModuleError(err);
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

function assertSubscribeRateLimit(socketId: string): void {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (subscribeTimestamps.get(socketId) ?? []).filter(
    t => t >= windowStart,
  );
  if (timestamps.length >= MAX_SUBSCRIBE_PER_MINUTE) {
    throw new ModuleError(errors.SUBSCRIBE_RATE_LIMIT_EXCEEDED);
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
    throw toModuleError(err);
  }
}

function toModuleError(err: unknown): ModuleError {
  return toSubscriptionError(err).toModuleError();
}

export { authorizeRelaySubscription } from './authorize.js';

/** @internal test helper */
export function _clearEventRelaySocketStateForTests(): void {
  _clearEventRelaySubscriptionStateForTests();
  subscribeTimestamps.clear();
}
