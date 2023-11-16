import { Query } from '@conduitplatform/grpc-sdk';
import { ChatMessage } from '../models';

export const migrateChatMessages = async () => {
  const query: Query<ChatMessage> = {
    deleted: { $exists: false },
  };
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
