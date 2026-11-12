import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';
import { ChatMessage } from '../models/index.js';
import { errors } from '../errors.js';

export async function editChatMessage(
  grpcSdk: ConduitGrpcSdk,
  params: { messageId: string; userId: string; newMessage: string },
): Promise<void> {
  if (!ConfigController.getInstance().config.allowMessageEdit) {
    throw new ModuleError(errors.MESSAGE_EDIT_DISABLED);
  }

  const { messageId, userId, newMessage } = params;

  const message = await grpcSdk
    .database!.findOne<ChatMessage>(ChatMessage.name, { _id: messageId, deleted: false })
    .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
  if (isNil(message) || message.senderUser !== userId) {
    throw new ModuleError(errors.MESSAGE_NOT_FOUND);
  }

  await grpcSdk
    .database!.findByIdAndUpdate<ChatMessage>(ChatMessage.name, message._id, {
      message: newMessage,
    })
    .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));

  grpcSdk.router?.socketPush({
    event: 'message-edited',
    receivers: [],
    rooms: [message.room as string],
    data: JSON.stringify({
      messageId,
      message: newMessage,
      room: message.room,
    }),
  });

  grpcSdk.bus?.publish(
    'chat:edit:ChatMessage',
    JSON.stringify({ id: messageId, newMessage }),
  );
}
