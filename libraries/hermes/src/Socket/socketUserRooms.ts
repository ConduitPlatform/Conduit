/**
 * Every authenticated socket joins a per-user room so pushes addressed to users
 * can be routed by the adapter instead of fetching every socket in the namespace.
 */
export const USER_ROOM_PREFIX = 'conduit:user:';

export function userRoom(userId: string): string {
  return `${USER_ROOM_PREFIX}${userId}`;
}
