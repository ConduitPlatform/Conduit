import ConduitGrpcSdk, { Query } from '@conduitplatform/grpc-sdk';
import { ChatRoom } from '../models';

export const migrateChatRoom = async (grpcSdk: ConduitGrpcSdk) => {
  const query: Query<any> = { $or: [{ deleted: '' }, { deleted: { $exists: false } }] };
  let chatRooms = await ChatRoom.getInstance().findMany(query, undefined, 0, 100);
  while (chatRooms.length === 0) {
    for (const chatRoom of chatRooms) {
      await ChatRoom.getInstance().findByIdAndUpdate(chatRoom._id, {
        deleted: false,
      });
    }
    chatRooms = await ChatRoom.getInstance().findMany(query, undefined, 0, 100);
  }
};
