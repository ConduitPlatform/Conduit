import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { editChatMessage } from './editMessage.js';

const EXISTING_MESSAGE = {
  _id: 'msg-1',
  senderUser: 'user-1',
  room: 'room-1',
};

const NOT_FOUND_OR_NO_ACCESS = "Message does not exist or you don't have access";

function createSdk(message: typeof EXISTING_MESSAGE | null) {
  const finds: unknown[] = [];
  const updates: unknown[] = [];
  const socketPushes: unknown[] = [];
  const busEvents: unknown[] = [];
  return {
    finds,
    updates,
    socketPushes,
    busEvents,
    grpcSdk: {
      database: {
        async findOne(schemaName: string, query: unknown) {
          finds.push({ schemaName, query });
          return message;
        },
        async findByIdAndUpdate(schemaName: string, id: string, document: unknown) {
          updates.push({ schemaName, id, document });
          return { ...message, ...(document as object) };
        },
      },
      router: {
        socketPush(payload: unknown) {
          socketPushes.push(payload);
        },
      },
      bus: {
        publish(event: string, payload: string) {
          busEvents.push({ event, payload });
        },
      },
    } as unknown as ConduitGrpcSdk,
  };
}

describe('editChatMessage', () => {
  let previousConfig: unknown;

  beforeEach(() => {
    previousConfig = ConfigController.getInstance().config;
    ConfigController.getInstance().config = { allowMessageEdit: true };
  });

  afterEach(() => {
    ConfigController.getInstance().config = previousConfig;
  });

  it('updates message text and broadcasts the same REST side effects', async () => {
    const sdk = createSdk(EXISTING_MESSAGE);

    await editChatMessage(sdk.grpcSdk, {
      messageId: 'msg-1',
      userId: 'user-1',
      newMessage: 'updated text',
    });

    assert.deepEqual(sdk.finds, [
      { schemaName: 'ChatMessage', query: { _id: 'msg-1', deleted: false } },
    ]);
    assert.deepEqual(sdk.updates, [
      { schemaName: 'ChatMessage', id: 'msg-1', document: { message: 'updated text' } },
    ]);
    assert.deepEqual(sdk.socketPushes, [
      {
        event: 'message-edited',
        receivers: [],
        rooms: ['room-1'],
        data: JSON.stringify({
          messageId: 'msg-1',
          message: 'updated text',
          room: 'room-1',
        }),
      },
    ]);
    assert.deepEqual(sdk.busEvents, [
      {
        event: 'chat:edit:ChatMessage',
        payload: JSON.stringify({ id: 'msg-1', newMessage: 'updated text' }),
      },
    ]);
  });

  it('still writes and broadcasts when the new text matches the existing text', async () => {
    const sdk = createSdk({ ...EXISTING_MESSAGE });

    await editChatMessage(sdk.grpcSdk, {
      messageId: 'msg-1',
      userId: 'user-1',
      newMessage: 'same',
    });

    assert.equal(sdk.updates.length, 1);
    assert.equal(sdk.socketPushes.length, 1);
    assert.equal(sdk.busEvents.length, 1);
  });

  it('throws NOT_FOUND when the message is missing', async () => {
    const sdk = createSdk(null);

    await assert.rejects(
      () =>
        editChatMessage(sdk.grpcSdk, {
          messageId: 'missing',
          userId: 'user-1',
          newMessage: 'hi',
        }),
      { code: status.NOT_FOUND, message: NOT_FOUND_OR_NO_ACCESS },
    );
    assert.deepEqual(sdk.finds, [
      { schemaName: 'ChatMessage', query: { _id: 'missing', deleted: false } },
    ]);
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws NOT_FOUND when the message is deleted', async () => {
    const sdk = createSdk(null);

    await assert.rejects(
      () =>
        editChatMessage(sdk.grpcSdk, {
          messageId: 'deleted-msg',
          userId: 'user-1',
          newMessage: 'hi',
        }),
      { code: status.NOT_FOUND, message: NOT_FOUND_OR_NO_ACCESS },
    );
    assert.deepEqual(sdk.finds, [
      { schemaName: 'ChatMessage', query: { _id: 'deleted-msg', deleted: false } },
    ]);
    assert.equal(sdk.updates.length, 0);
  });

  it('throws NOT_FOUND when the acting user is not the sender', async () => {
    const sdk = createSdk(EXISTING_MESSAGE);

    await assert.rejects(
      () =>
        editChatMessage(sdk.grpcSdk, {
          messageId: 'msg-1',
          userId: 'other-user',
          newMessage: 'hi',
        }),
      { code: status.NOT_FOUND, message: NOT_FOUND_OR_NO_ACCESS },
    );
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws INVALID_ARGUMENT when newMessage is empty', async () => {
    const sdk = createSdk(EXISTING_MESSAGE);

    await assert.rejects(
      () =>
        editChatMessage(sdk.grpcSdk, {
          messageId: 'msg-1',
          userId: 'user-1',
          newMessage: '',
        }),
      { code: status.INVALID_ARGUMENT, message: 'newMessage is required' },
    );
    assert.equal(sdk.finds.length, 0);
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws FAILED_PRECONDITION and does not write when allowMessageEdit is false', async () => {
    ConfigController.getInstance().config = { allowMessageEdit: false };
    const sdk = createSdk(EXISTING_MESSAGE);

    await assert.rejects(
      () =>
        editChatMessage(sdk.grpcSdk, {
          messageId: 'msg-1',
          userId: 'user-1',
          newMessage: 'updated text',
        }),
      { code: status.FAILED_PRECONDITION, message: 'Message editing is disabled' },
    );
    assert.equal(sdk.finds.length, 0);
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });
});
