import ConduitGrpcSdk, { Query } from '@conduitplatform/grpc-sdk';
import { ChatMessage } from '../models';

export const migrateChatMessages = async (grpcSdk: ConduitGrpcSdk) => {
  const query: Query<any> = { $or: [{ deleted: '' }, { deleted: { $exists: false } }] };
  let chatMessages = await ChatMessage.getInstance().findMany(query, undefined, 0, 100);
  while (chatMessages.length === 0) {
    for (const chatMessage of chatMessages) {
      await ChatMessage.getInstance().findByIdAndUpdate(chatMessage._id, {
        deleted: false,
      });
    }
    chatMessages = await ChatMessage.getInstance().findMany(query, undefined, 0, 100);
  }
};
