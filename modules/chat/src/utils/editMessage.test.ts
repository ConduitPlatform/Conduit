import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import {
  editChatMessage,
  MESSAGE_NOT_FOUND_OR_NO_ACCESS,
  type ChatMessageEditStore,
  type EditableChatMessage,
} from './editMessage.js';

const EXISTING_MESSAGE: EditableChatMessage = {
  _id: 'msg-1',
  senderUser: 'user-1',
  room: 'room-1',
};

function createStore(message: EditableChatMessage | null): ChatMessageEditStore & {
  finds: unknown[];
  updates: unknown[];
} {
  const finds: unknown[] = [];
  const updates: unknown[] = [];
  return {
    finds,
    updates,
    async findOne(query: { _id: string; deleted: false }) {
      finds.push(query);
      return message;
    },
    async findByIdAndUpdate(id: string, update: { message: string }) {
      updates.push({ id, update });
      return { ...message, ...update };
    },
  };
}

function createSdk() {
  const socketPushes: unknown[] = [];
  const busEvents: unknown[] = [];
  return {
    socketPushes,
    busEvents,
    grpcSdk: {
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
    const store = createStore(EXISTING_MESSAGE);
    const sdk = createSdk();

    await editChatMessage(
      sdk.grpcSdk,
      { messageId: 'msg-1', userId: 'user-1', newMessage: 'updated text' },
      store,
    );

    assert.deepEqual(store.finds, [{ _id: 'msg-1', deleted: false }]);
    assert.deepEqual(store.updates, [
      { id: 'msg-1', update: { message: 'updated text' } },
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
    const store = createStore({ ...EXISTING_MESSAGE });
    const sdk = createSdk();

    await editChatMessage(
      sdk.grpcSdk,
      { messageId: 'msg-1', userId: 'user-1', newMessage: 'same' },
      store,
    );

    assert.equal(store.updates.length, 1);
    assert.equal(sdk.socketPushes.length, 1);
    assert.equal(sdk.busEvents.length, 1);
  });

  it('throws NOT_FOUND when the message is missing', async () => {
    const store = createStore(null);
    const sdk = createSdk();

    await assert.rejects(
      () =>
        editChatMessage(
          sdk.grpcSdk,
          { messageId: 'missing', userId: 'user-1', newMessage: 'hi' },
          store,
        ),
      { code: status.NOT_FOUND, message: MESSAGE_NOT_FOUND_OR_NO_ACCESS },
    );
    assert.deepEqual(store.finds, [{ _id: 'missing', deleted: false }]);
    assert.equal(store.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws NOT_FOUND when the message is deleted', async () => {
    const store = createStore(null);
    const sdk = createSdk();

    await assert.rejects(
      () =>
        editChatMessage(
          sdk.grpcSdk,
          { messageId: 'deleted-msg', userId: 'user-1', newMessage: 'hi' },
          store,
        ),
      { code: status.NOT_FOUND, message: MESSAGE_NOT_FOUND_OR_NO_ACCESS },
    );
    assert.deepEqual(store.finds, [{ _id: 'deleted-msg', deleted: false }]);
    assert.equal(store.updates.length, 0);
  });

  it('throws NOT_FOUND when the acting user is not the sender', async () => {
    const store = createStore(EXISTING_MESSAGE);
    const sdk = createSdk();

    await assert.rejects(
      () =>
        editChatMessage(
          sdk.grpcSdk,
          { messageId: 'msg-1', userId: 'other-user', newMessage: 'hi' },
          store,
        ),
      { code: status.NOT_FOUND, message: MESSAGE_NOT_FOUND_OR_NO_ACCESS },
    );
    assert.equal(store.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws INVALID_ARGUMENT when newMessage is empty', async () => {
    const store = createStore(EXISTING_MESSAGE);
    const sdk = createSdk();

    await assert.rejects(
      () =>
        editChatMessage(
          sdk.grpcSdk,
          { messageId: 'msg-1', userId: 'user-1', newMessage: '' },
          store,
        ),
      { code: status.INVALID_ARGUMENT, message: 'newMessage is required' },
    );
    assert.equal(store.finds.length, 0);
    assert.equal(store.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws FAILED_PRECONDITION and does not write when allowMessageEdit is false', async () => {
    ConfigController.getInstance().config = { allowMessageEdit: false };
    const store = createStore(EXISTING_MESSAGE);
    const sdk = createSdk();

    await assert.rejects(
      () =>
        editChatMessage(
          sdk.grpcSdk,
          { messageId: 'msg-1', userId: 'user-1', newMessage: 'updated text' },
          store,
        ),
      { code: status.FAILED_PRECONDITION, message: 'Message editing is disabled' },
    );
    assert.equal(store.finds.length, 0);
    assert.equal(store.updates.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });
});
