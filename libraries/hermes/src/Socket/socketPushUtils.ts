export const WRITE_BUFFER_PACKET_HIGH_WATER = 64;

type SocketData = { userId?: string; user?: { _id?: string } };

/** Resolves the authenticated user id from socket data (JWT mode sets `userId`, legacy sets `user`). */
export function socketUserId(data?: SocketData | null): string | undefined {
  return data?.userId ?? data?.user?._id;
}

type SocketLike = {
  id: string;
  data?: SocketData;
  rooms: Set<string>;
};

export function filterRemoteSocketsByUserAndRooms(
  sockets: SocketLike[],
  userIds: string[],
  rooms: string[],
): SocketLike[] {
  const userIdSet = new Set(userIds);
  const roomSet = rooms.length > 0 ? new Set(rooms) : null;
  return sockets.filter(socket => {
    const userId = socketUserId(socket.data);
    if (!userId) {
      return false;
    }
    if (!userIdSet.has(userId)) {
      return false;
    }
    if (roomSet) {
      return [...roomSet].some(room => socket.rooms.has(room));
    }
    return true;
  });
}

export function isEngineSocketBackpressured(
  conn: { writeBuffer?: unknown[] } | undefined,
  highWater = WRITE_BUFFER_PACKET_HIGH_WATER,
): boolean {
  const pending = conn?.writeBuffer?.length ?? 0;
  return pending > highWater;
}
