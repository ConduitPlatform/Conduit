import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { editChatMessage } from './editChatMessage.js';

const MESSAGE_ID = 'msg-1';
const USER_ID = 'user-1';
const ROOM_ID = 'room-1';
const NEW_MESSAGE = 'updated text';
const NOT_FOUND = "Message does not exist or you don't have access";

const existingMessage = {
  _id: MESSAGE_ID,
  senderUser: USER_ID,
  room: ROOM_ID,
};

function mockGrpcSdk(message: typeof existingMessage | null = existingMessage) {
  const findOne = mock.fn(async () => message);
  const findByIdAndUpdate = mock.fn(async () => ({}));
  const socketPush = mock.fn();
  const publish = mock.fn();
  return {
    grpcSdk: {
      database: { findOne, findByIdAndUpdate },
      router: { socketPush },
      bus: { publish },
    } as unknown as ConduitGrpcSdk,
    findOne,
    findByIdAndUpdate,
    socketPush,
    publish,
  };
}

describe('editChatMessage', () => {
  beforeEach(() => {
    ConfigController.getInstance().config = { allowMessageEdit: true };
  });

  it('updates message text and emits socket and bus events', async () => {
    const { grpcSdk, findOne, findByIdAndUpdate, socketPush, publish } = mockGrpcSdk();

    await editChatMessage(grpcSdk, {
      messageId: MESSAGE_ID,
      userId: USER_ID,
      newMessage: NEW_MESSAGE,
    });

    assert.equal(findOne.mock.callCount(), 1);
    assert.deepEqual(findOne.mock.calls[0].arguments, [
      'ChatMessage',
      { _id: MESSAGE_ID, deleted: false },
    ]);
    assert.equal(findByIdAndUpdate.mock.callCount(), 1);
    assert.deepEqual(findByIdAndUpdate.mock.calls[0].arguments, [
      'ChatMessage',
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
    const { grpcSdk, findByIdAndUpdate, socketPush, publish } = mockGrpcSdk();

    await editChatMessage(grpcSdk, {
      messageId: MESSAGE_ID,
      userId: USER_ID,
      newMessage: 'same',
    });

    assert.equal(findByIdAndUpdate.mock.callCount(), 1);
    assert.equal(socketPush.mock.callCount(), 1);
    assert.equal(publish.mock.callCount(), 1);
  });

  it('returns NOT_FOUND when the message is missing', async () => {
    const { grpcSdk, findByIdAndUpdate, socketPush, publish } = mockGrpcSdk(null);

    await assert.rejects(
      () =>
        editChatMessage(grpcSdk, {
          messageId: MESSAGE_ID,
          userId: USER_ID,
          newMessage: NEW_MESSAGE,
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.NOT_FOUND &&
        err.message === NOT_FOUND,
    );
    assert.equal(findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('queries deleted:false so deleted messages are NOT_FOUND', async () => {
    const { grpcSdk, findOne, findByIdAndUpdate, socketPush, publish } =
      mockGrpcSdk(null);

    await assert.rejects(
      () =>
        editChatMessage(grpcSdk, {
          messageId: MESSAGE_ID,
          userId: USER_ID,
          newMessage: NEW_MESSAGE,
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.NOT_FOUND &&
        err.message === NOT_FOUND,
    );
    assert.deepEqual(findOne.mock.calls[0].arguments, [
      'ChatMessage',
      { _id: MESSAGE_ID, deleted: false },
    ]);
    assert.equal(findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('returns NOT_FOUND when the acting user is not the sender', async () => {
    const { grpcSdk, findByIdAndUpdate, socketPush, publish } = mockGrpcSdk({
      ...existingMessage,
      senderUser: 'other-user',
    });

    await assert.rejects(
      () =>
        editChatMessage(grpcSdk, {
          messageId: MESSAGE_ID,
          userId: USER_ID,
          newMessage: NEW_MESSAGE,
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.NOT_FOUND &&
        err.message === NOT_FOUND,
    );
    assert.equal(findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });

  it('still updates and broadcasts when newMessage is empty', async () => {
    const { grpcSdk, findByIdAndUpdate, socketPush, publish } = mockGrpcSdk();

    await editChatMessage(grpcSdk, {
      messageId: MESSAGE_ID,
      userId: USER_ID,
      newMessage: '',
    });

    assert.equal(findByIdAndUpdate.mock.callCount(), 1);
    assert.deepEqual(findByIdAndUpdate.mock.calls[0].arguments, [
      'ChatMessage',
      MESSAGE_ID,
      { message: '' },
    ]);
    assert.equal(socketPush.mock.callCount(), 1);
    assert.equal(publish.mock.callCount(), 1);
  });

  it('does not write when allowMessageEdit is false', async () => {
    ConfigController.getInstance().config = { allowMessageEdit: false };
    const { grpcSdk, findOne, findByIdAndUpdate, socketPush, publish } = mockGrpcSdk();

    await assert.rejects(
      () =>
        editChatMessage(grpcSdk, {
          messageId: MESSAGE_ID,
          userId: USER_ID,
          newMessage: NEW_MESSAGE,
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.FAILED_PRECONDITION &&
        err.message === 'Message editing is disabled',
    );
    assert.equal(findOne.mock.callCount(), 0);
    assert.equal(findByIdAndUpdate.mock.callCount(), 0);
    assert.equal(socketPush.mock.callCount(), 0);
    assert.equal(publish.mock.callCount(), 0);
  });
});
