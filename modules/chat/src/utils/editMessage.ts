import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';
import { ChatMessage } from '../models/index.js';

export async function editChatMessage(
  grpcSdk: ConduitGrpcSdk,
  params: { messageId: string; userId: string; newMessage: string },
): Promise<void> {
  if (!ConfigController.getInstance().config.allowMessageEdit) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'Message editing is disabled');
  }

  const { messageId, userId, newMessage } = params;
  if (isNil(newMessage) || newMessage === '') {
    throw new GrpcError(status.INVALID_ARGUMENT, 'newMessage is required');
  }

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

  await grpcSdk
    .database!.findByIdAndUpdate<ChatMessage>(ChatMessage.name, message._id, {
      message: newMessage,
    })
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

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
