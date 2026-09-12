import { eventRelayRoom } from './rooms.js';
import { MAX_ROOMS_PER_SOCKET } from './constants.js';

export type RelaySubscription = {
  relayId: string;
  resourceId: string;
};

const subscriptionsBySocket = new Map<string, RelaySubscription[]>();
const subscriptionsByUser = new Map<string, RelaySubscription[]>();

export function trackSubscription(
  socketId: string,
  userId: string,
  relayId: string,
  resourceId: string,
): void {
  const entry = { relayId, resourceId };
  const socketSubs = subscriptionsBySocket.get(socketId) ?? [];
  const withoutDup = socketSubs.filter(
    sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
  );
  withoutDup.push(entry);
  if (withoutDup.length > MAX_ROOMS_PER_SOCKET) {
    throw new Error(`Cannot subscribe to more than ${MAX_ROOMS_PER_SOCKET} relay rooms`);
  }
  subscriptionsBySocket.set(socketId, withoutDup);

  const userSubs = subscriptionsByUser.get(userId) ?? [];
  const userWithoutDup = userSubs.filter(
    sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
  );
  userWithoutDup.push(entry);
  subscriptionsByUser.set(userId, userWithoutDup);
}

export function removeSubscription(
  socketId: string,
  userId: string | undefined,
  relayId: string,
  resourceId: string,
): void {
  const socketSubs = subscriptionsBySocket.get(socketId);
  if (socketSubs) {
    subscriptionsBySocket.set(
      socketId,
      socketSubs.filter(
        sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
      ),
    );
  }
  if (userId) {
    const userSubs = subscriptionsByUser.get(userId);
    if (userSubs) {
      subscriptionsByUser.set(
        userId,
        userSubs.filter(
          sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
        ),
      );
    }
  }
}

export function clearSocketSubscriptionTracking(socketId: string): void {
  subscriptionsBySocket.delete(socketId);
}

export function subscriptionsForUser(userId: string): RelaySubscription[] {
  return [...(subscriptionsByUser.get(userId) ?? [])];
}

export function removeSubscriptionsForRelay(relayId: string): void {
  for (const [socketId, subs] of subscriptionsBySocket) {
    const next = subs.filter(sub => sub.relayId !== relayId);
    if (next.length === 0) {
      subscriptionsBySocket.delete(socketId);
    } else {
      subscriptionsBySocket.set(socketId, next);
    }
  }
  for (const [userId, subs] of subscriptionsByUser) {
    const next = subs.filter(sub => sub.relayId !== relayId);
    if (next.length === 0) {
      subscriptionsByUser.delete(userId);
    } else {
      subscriptionsByUser.set(userId, next);
    }
  }
}

export function leaveRoomsForRelay(relayId: string): string[] {
  const rooms = new Set<string>();
  for (const subs of subscriptionsByUser.values()) {
    for (const sub of subs) {
      if (sub.relayId === relayId) {
        rooms.add(eventRelayRoom(relayId, sub.resourceId));
      }
    }
  }
  return [...rooms];
}

/** @internal test helper */
export function _clearEventRelaySubscriptionStateForTests(): void {
  subscriptionsBySocket.clear();
  subscriptionsByUser.clear();
}
