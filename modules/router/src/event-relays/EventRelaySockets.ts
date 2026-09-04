import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError, TYPE } from '@conduitplatform/grpc-sdk';
import { ConduitSocket, ConduitSocketEvent } from '@conduitplatform/hermes';
import { EVENTS_NAMESPACE } from './constants.js';
import { EventRelayManager } from './EventRelayManager.js';
import { eventRelayRoom } from './rooms.js';
import { validateResourceId } from './validation.js';
import { authorizeRelaySubscription, toSubscriptionError } from './authorize.js';

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
    handler: async () => ({ event: 'leave-room', rooms: [] }),
  });

  events.set('subscribe', {
    name: 'subscribe',
    params: [TYPE.String, TYPE.String],
    handler: async request => {
      const userId = request.context?.user?._id as string | undefined;
      const [relayId, resourceId] = request.params ?? [];
      const room = await authorizeOrThrow(grpcSdk, manager, userId, relayId, resourceId);
      return { event: 'join-room', rooms: [room] };
    },
  });

  events.set('unsubscribe', {
    name: 'unsubscribe',
    params: [TYPE.String, TYPE.String],
    handler: async request => {
      const [relayId, resourceId] = request.params ?? [];
      if (typeof relayId !== 'string' || relayId.trim() === '') {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Relay ID is required');
      }
      try {
        const validatedResourceId = validateResourceId(resourceId);
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
    },
    events,
  );
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
