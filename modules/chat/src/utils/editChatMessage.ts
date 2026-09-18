import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash-es';

export const MESSAGE_EDIT_NOT_FOUND = "Message does not exist or you don't have access";

export type EditableChatMessage = {
  _id: string;
  senderUser: unknown;
  room: unknown;
};

export type ChatMessageEditStore = {
  findOne: (query: {
    _id: string;
    deleted: false;
  }) => Promise<EditableChatMessage | null>;
  findByIdAndUpdate: (id: string, update: { message: string }) => Promise<unknown>;
};

export async function editChatMessage(
  grpcSdk: ConduitGrpcSdk,
  input: { messageId: string; userId: string; newMessage: string },
  messages: ChatMessageEditStore,
): Promise<void> {
  const { messageId, userId, newMessage } = input;

  if (!newMessage) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'newMessage is required');
  }

  if (!ConfigController.getInstance().config.allowMessageEdit) {
    throw new GrpcError(status.FAILED_PRECONDITION, 'Message editing is disabled');
  }

  const message = await messages
    .findOne({ _id: messageId, deleted: false })
    .catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
  if (isNil(message) || message.senderUser !== userId) {
    throw new GrpcError(status.NOT_FOUND, MESSAGE_EDIT_NOT_FOUND);
  }

  await messages
    .findByIdAndUpdate(message._id, { message: newMessage })
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
