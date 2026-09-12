import { eventRelayRoom } from './rooms.js';
import { MAX_ROOMS_PER_SOCKET } from './constants.js';

export type RelaySubscription = {
  relayId: string;
  resourceId: string;
};

const subscriptionsBySocket = new Map<string, RelaySubscription[]>();
const subscriptionsByUser = new Map<string, RelaySubscription[]>();
const subscriptionsByRoom = new Map<string, RelaySubscription & { userId: string }>();

export function trackSubscription(
  socketId: string,
  userId: string,
  relayId: string,
  resourceId: string,
): void {
  const entry = { relayId, resourceId };
  const room = eventRelayRoom(relayId, resourceId);
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
  subscriptionsByRoom.set(room, { relayId, resourceId, userId });
}

export function removeSubscription(
  socketId: string,
  userId: string | undefined,
  relayId: string,
  resourceId: string,
): void {
  const socketSubs = subscriptionsBySocket.get(socketId);
  if (socketSubs) {
    const next = socketSubs.filter(
      sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
    );
    if (next.length === 0) {
      subscriptionsBySocket.delete(socketId);
    } else {
      subscriptionsBySocket.set(socketId, next);
    }
  }
  if (userId && !isSubscriptionTrackedOnOtherSocket(relayId, resourceId, socketId)) {
    const userSubs = subscriptionsByUser.get(userId);
    if (userSubs) {
      const next = userSubs.filter(
        sub => !(sub.relayId === relayId && sub.resourceId === resourceId),
      );
      if (next.length === 0) {
        subscriptionsByUser.delete(userId);
      } else {
        subscriptionsByUser.set(userId, next);
      }
    }
    if (!isSubscriptionTrackedOnAnySocket(relayId, resourceId)) {
      subscriptionsByRoom.delete(eventRelayRoom(relayId, resourceId));
    }
  }
}

function isSubscriptionTrackedOnOtherSocket(
  relayId: string,
  resourceId: string,
  exceptSocketId: string,
): boolean {
  for (const [socketId, subs] of subscriptionsBySocket) {
    if (socketId === exceptSocketId) {
      continue;
    }
    if (subs.some(sub => sub.relayId === relayId && sub.resourceId === resourceId)) {
      return true;
    }
  }
  return false;
}

function isSubscriptionTrackedOnAnySocket(relayId: string, resourceId: string): boolean {
  for (const subs of subscriptionsBySocket.values()) {
    if (subs.some(sub => sub.relayId === relayId && sub.resourceId === resourceId)) {
      return true;
    }
  }
  return false;
}

export function releaseSocketSubscriptions(socketId: string, userId?: string): void {
  const subs = subscriptionsBySocket.get(socketId) ?? [];
  subscriptionsBySocket.delete(socketId);
  if (!userId) {
    return;
  }
  for (const sub of subs) {
    if (!isSubscriptionTrackedOnOtherSocket(sub.relayId, sub.resourceId, socketId)) {
      const userSubs = subscriptionsByUser.get(userId);
      if (!userSubs) {
        continue;
      }
      const next = userSubs.filter(
        entry =>
          !(entry.relayId === sub.relayId && entry.resourceId === sub.resourceId),
      );
      if (next.length === 0) {
        subscriptionsByUser.delete(userId);
      } else {
        subscriptionsByUser.set(userId, next);
      }
    }
  }
}

export function subscriptionsForRecoveredRooms(
  userId: string,
  recoveredRooms: string[],
): RelaySubscription[] {
  const subs: RelaySubscription[] = [];
  for (const room of recoveredRooms) {
    if (!room.startsWith('er:')) {
      continue;
    }
    const entry = subscriptionsByRoom.get(room);
    if (entry?.userId === userId) {
      subs.push({ relayId: entry.relayId, resourceId: entry.resourceId });
    }
  }
  return subs;
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
  for (const [room, entry] of subscriptionsByRoom) {
    if (entry.relayId === relayId) {
      subscriptionsByRoom.delete(room);
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
  subscriptionsByRoom.clear();
}
