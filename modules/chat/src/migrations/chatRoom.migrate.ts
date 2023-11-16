import { Query } from '@conduitplatform/grpc-sdk';
import { ChatRoom } from '../models';

export const migrateChatRoom = async () => {
  const query: Query<ChatRoom> = {
    $or: [{ deleted: { $exists: false } }],
  };
  let chatRooms = await ChatRoom.getInstance().findMany(query, undefined, 0, 100);
  while (chatRooms.length === 0) {
    for (const chatRoom of chatRooms) {
      await ChatRoom.getInstance().findByIdAndUpdate(chatRoom._id, {
        deleted: false,
        participantsLog: [],
      });
    }
    chatRooms = await ChatRoom.getInstance().findMany(query, undefined, 0, 100);
  }
};
