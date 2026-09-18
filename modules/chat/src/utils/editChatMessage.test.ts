import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import {
  editChatMessage,
  MESSAGE_EDIT_NOT_FOUND,
  type ChatMessageEditStore,
  type EditableChatMessage,
} from './editChatMessage.js';

const MESSAGE_ID = 'msg-1';
const USER_ID = 'user-1';
const ROOM_ID = 'room-1';
const NEW_MESSAGE = 'updated text';

const existingMessage: EditableChatMessage = {
  _id: MESSAGE_ID,
  senderUser: USER_ID,
  room: ROOM_ID,
};

function mockGrpcSdk() {
  const socketPush = mock.fn();
  const publish = mock.fn();
  return {
    grpcSdk: {
      router: { socketPush },
      bus: { publish },
    } as unknown as Parameters<typeof editChatMessage>[0],
    socketPush,
    publish,
  };
}

function mockStore(
  message: EditableChatMessage | null = existingMessage,
): ChatMessageEditStore & {
  findOne: ReturnType<typeof mock.fn>;
  findByIdAndUpdate: ReturnType<typeof mock.fn>;
} {
  const findOne = mock.fn(async () => message);
  const findByIdAndUpdate = mock.fn(async () => ({}));
  return { findOne, findByIdAndUpdate };
}

async function assertGrpcError(
  fn: () => Promise<unknown>,
  code: status,
  message: string,
) {
  await assert.rejects(fn, (err: unknown) => {
    return err instanceof GrpcError && err.code === code && err.message === message;
  });
}

describe('editChatMessage', () => {
  beforeEach(() => {
    ConfigController.getInstance().config = { allowMessageEdit: true };
  });

  it('updates message text and emits socket and bus events', async () => {
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore();

    await editChatMessage(
      grpcSdk,
      { messageId: MESSAGE_ID, userId: USER_ID, newMessage: NEW_MESSAGE },
      messages,
    );

    assert.equal(messages.findOne.mock.callCount(), 1);
    assert.deepEqual(messages.findOne.mock.calls[0].arguments[0], {
      _id: MESSAGE_ID,
      deleted: false,
    });
    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 1);
    assert.deepEqual(messages.findByIdAndUpdate.mock.calls[0].arguments, [
      MESSAGE_ID,
      { message: NEW_MESSAGE },
    ]);
    assert.equal(socketPush.mock.callCount(), 1);
    assert.deepEqual(socketPush.mock.calls[0].arguments[0], {
      event: 'message-edited',
      receivers: [],
      rooms: [ROOM_ID],
      data: JSON.stringify({
        messageId: MESSAGE_ID,
        message: NEW_MESSAGE,
        room: ROOM_ID,
      }),
    });
    assert.equal(publish.mock.callCount(), 1);
    assert.deepEqual(publish.mock.calls[0].arguments, [
      'chat:edit:ChatMessage',
      JSON.stringify({ id: MESSAGE_ID, newMessage: NEW_MESSAGE }),
    ]);
  });

  it('still updates and broadcasts when the text is unchanged', async () => {
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore();

    await editChatMessage(
      grpcSdk,
      { messageId: MESSAGE_ID, userId: USER_ID, newMessage: 'same' },
      messages,
    );

    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 1);
    assert.equal(socketPush.mock.callCount(), 1);
    assert.equal(publish.mock.callCount(), 1);
  });

  it('returns NOT_FOUND when the message is missing', async () => {
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore(null);

    await assertGrpcError(
      () =>
        editChatMessage(
          grpcSdk,
          { messageId: MESSAGE_ID, userId: USER_ID, newMessage: NEW_MESSAGE },
          messages,
        ),
      status.NOT_FOUND,
      MESSAGE_EDIT_NOT_FOUND,
    );
    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('queries deleted:false so deleted messages are NOT_FOUND', async () => {
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore(null);

    await assertGrpcError(
      () =>
        editChatMessage(
          grpcSdk,
          { messageId: MESSAGE_ID, userId: USER_ID, newMessage: NEW_MESSAGE },
          messages,
        ),
      status.NOT_FOUND,
      MESSAGE_EDIT_NOT_FOUND,
    );
    assert.deepEqual(messages.findOne.mock.calls[0].arguments[0], {
      _id: MESSAGE_ID,
      deleted: false,
    });
    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('returns NOT_FOUND when the acting user is not the sender', async () => {
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore({
      ...existingMessage,
      senderUser: 'other-user',
    });

    await assertGrpcError(
      () =>
        editChatMessage(
          grpcSdk,
          { messageId: MESSAGE_ID, userId: USER_ID, newMessage: NEW_MESSAGE },
          messages,
        ),
      status.NOT_FOUND,
      MESSAGE_EDIT_NOT_FOUND,
    );
    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('returns INVALID_ARGUMENT when newMessage is empty', async () => {
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore();

    await assertGrpcError(
      () =>
        editChatMessage(
          grpcSdk,
          { messageId: MESSAGE_ID, userId: USER_ID, newMessage: '' },
          messages,
        ),
      status.INVALID_ARGUMENT,
      'newMessage is required',
    );
    assert.equal(messages.findOne.mock.callCount(), 0);
    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('does not write when allowMessageEdit is false', async () => {
    ConfigController.getInstance().config = { allowMessageEdit: false };
    const { grpcSdk, socketPush, publish } = mockGrpcSdk();
    const messages = mockStore();

    await assertGrpcError(
      () =>
        editChatMessage(
          grpcSdk,
          { messageId: MESSAGE_ID, userId: USER_ID, newMessage: NEW_MESSAGE },
          messages,
        ),
      status.FAILED_PRECONDITION,
      'Message editing is disabled',
    );
    assert.equal(messages.findOne.mock.callCount(), 0);
    assert.equal(messages.findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });
});
