/**
 * Every authenticated socket joins a per-user room so pushes addressed to users
 * can be routed by the adapter instead of fetching every socket in the namespace.
 */
export const USER_ROOM_PREFIX = 'conduit:user:';

export function userRoom(userId: string): string {
  return `${USER_ROOM_PREFIX}${userId}`;
}

type SocketData = { userId?: string; user?: { _id?: string } } | null | undefined;

/** Authenticated user id from socket data (`userId` in JWT mode, `user._id` otherwise). */
export function socketDataUserId(data: SocketData): string | undefined {
  const id = data?.userId ?? data?.user?._id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}
