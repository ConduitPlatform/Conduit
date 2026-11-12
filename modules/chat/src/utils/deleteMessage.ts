import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController, ModuleError } from '@conduitplatform/module-tools';
import { isNil } from 'lodash-es';
import { ChatMessage } from '../models/index.js';
import { errors } from '../errors.js';

export async function deleteChatMessage(
  grpcSdk: ConduitGrpcSdk,
  params: { messageId: string; userId: string },
): Promise<void> {
  if (!ConfigController.getInstance().config.allowMessageDelete) {
    throw new ModuleError(errors.MESSAGE_DELETE_DISABLED);
  }

  const { messageId, userId } = params;

  const message = await grpcSdk
    .database!.findOne<ChatMessage>(ChatMessage.name, { _id: messageId, deleted: false })
    .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
  if (isNil(message) || message.senderUser !== userId) {
    throw new ModuleError(errors.MESSAGE_NOT_FOUND);
  }

  if (ConfigController.getInstance().config.auditMode) {
    await grpcSdk
      .database!.findByIdAndUpdate<ChatMessage>(ChatMessage.name, message._id, {
        deleted: true,
      })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
  } else {
    await grpcSdk
      .database!.deleteOne<ChatMessage>(ChatMessage.name, { _id: messageId })
      .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR));
  }

  grpcSdk.router?.socketPush({
    event: 'message-deleted',
    receivers: [],
    rooms: [message.room as string],
    data: JSON.stringify({ messageId, room: message.room }),
  });

  grpcSdk.bus?.publish('chat:delete:ChatMessage', JSON.stringify(messageId));
}
