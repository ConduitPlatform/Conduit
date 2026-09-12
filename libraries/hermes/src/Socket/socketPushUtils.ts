export const WRITE_BUFFER_PACKET_HIGH_WATER = 64;

type SocketLike = {
  id: string;
  data?: { user?: { _id?: string } };
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
    if (!socket.data?.user?._id) {
      return false;
    }
    if (!userIdSet.has(socket.data.user._id)) {
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
