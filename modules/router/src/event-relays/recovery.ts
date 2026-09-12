import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  authorizeRelaySubscription,
  RelaySubscriptionError,
  RelayLookup,
  toSubscriptionError,
} from './authorize.js';
import { eventRelayRoom } from './rooms.js';
import {
  removeSubscription,
  subscriptionsForRecoveredRooms,
  trackSubscription,
} from './subscriptions.js';
import { relaySubscriptionsFromContext, persistRelaySubscriptionOnContext, removeRelaySubscriptionFromContext } from './relaySocketData.js';

type RelayAuthorizationSdk = Parameters<typeof authorizeRelaySubscription>[0];

export async function reauthorizeRecoveredSubscriptions(
  grpcSdk: RelayAuthorizationSdk,
  manager: RelayLookup,
  request: {
    socketId: string;
    context?: { user?: { _id?: string } } & Record<string, unknown>;
    recoveredRooms?: string[];
  },
): Promise<
  { event: 'join-room'; rooms: string[] } | { event: 'leave-room'; rooms: string[] }
> {
  const userId = request.context?.user?._id as string | undefined;
  if (!userId) {
    return { event: 'leave-room', rooms: [] };
  }

  const recoveredRooms = request.recoveredRooms ?? [];
  const subs = subscriptionsForRecoveredRooms(
    recoveredRooms,
    relaySubscriptionsFromContext(request.context),
  );
  const leaveRooms: string[] = [];

  for (const sub of subs) {
    const room = eventRelayRoom(sub.relayId, sub.resourceId);
    try {
      await authorizeRelaySubscription(
        grpcSdk,
        manager,
        userId,
        sub.relayId,
        sub.resourceId,
        () => {
          ConduitGrpcSdk.Metrics?.increment('event_relay_subscriptions_denied_total');
        },
      );
      trackSubscription(request.socketId, userId, sub.relayId, sub.resourceId);
      persistRelaySubscriptionOnContext(request.context, sub.relayId, sub.resourceId);
    } catch (err) {
      const mapped =
        err instanceof RelaySubscriptionError ? err : toSubscriptionError(err);
      if (mapped.code === status.UNAVAILABLE) {
        trackSubscription(request.socketId, userId, sub.relayId, sub.resourceId);
        persistRelaySubscriptionOnContext(request.context, sub.relayId, sub.resourceId);
        continue;
      }
      if (
        mapped.code === status.PERMISSION_DENIED ||
        mapped.code === status.NOT_FOUND
      ) {
        removeSubscription(request.socketId, userId, sub.relayId, sub.resourceId);
        leaveRooms.push(room);
        ConduitGrpcSdk.Metrics?.increment('event_relay_subscriptions_denied_total');
        continue;
      }
      removeSubscription(request.socketId, userId, sub.relayId, sub.resourceId);
      leaveRooms.push(room);
    }
  }

  if (leaveRooms.length > 0) {
    return { event: 'leave-room', rooms: leaveRooms };
  }
  return { event: 'join-room', rooms: [] };
}
