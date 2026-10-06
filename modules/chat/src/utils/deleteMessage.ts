import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { ChatMessage } from '../models/index.js';

export async function deleteChatMessage(
  grpcSdk: ConduitGrpcSdk,
  params: { messageId: string; userId: string },
): Promise<void> {
  if (!ConfigController.getInstance().config.allowMessageDelete) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'Message deletion is disabled');
  }

  const { messageId, userId } = params;

  const message = await grpcSdk
    .database!.findOne<ChatMessage>(ChatMessage.name, { _id: messageId, deleted: false })
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
  if (isNil(message) || message.senderUser !== userId) {
    throw new GrpcError(
      status.NOT_FOUND,
      "Message does not exist or you don't have access",
    );
  }

  if (ConfigController.getInstance().config.auditMode) {
    await grpcSdk
      .database!.findByIdAndUpdate<ChatMessage>(ChatMessage.name, message._id, {
        deleted: true,
      })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  } else {
    await grpcSdk
      .database!.deleteOne<ChatMessage>(ChatMessage.name, { _id: messageId })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
  }

  grpcSdk.router?.socketPush({
    event: 'message-deleted',
    receivers: [],
    rooms: [message.room as string],
    data: JSON.stringify({ messageId, room: message.room }),
  });

  grpcSdk.bus?.publish('chat:delete:ChatMessage', JSON.stringify(messageId));
}
