import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { deleteChatMessage } from './deleteMessage.js';

const EXISTING_MESSAGE = {
  _id: 'msg-1',
  senderUser: 'user-1',
  room: 'room-1',
};

const NOT_FOUND_OR_NO_ACCESS = "Message does not exist or you don't have access";

function createSdk(message: typeof EXISTING_MESSAGE | null) {
  const finds: unknown[] = [];
  const updates: unknown[] = [];
  const deletes: unknown[] = [];
  const socketPushes: unknown[] = [];
  const busEvents: unknown[] = [];
  return {
    finds,
    updates,
    deletes,
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
        async deleteOne(schemaName: string, query: unknown) {
          deletes.push({ schemaName, query });
          return { deletedCount: 1 };
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

function assertBroadcast(sdk: ReturnType<typeof createSdk>) {
  assert.deepEqual(sdk.socketPushes, [
    {
      event: 'message-deleted',
      receivers: [],
      rooms: ['room-1'],
      data: JSON.stringify({ messageId: 'msg-1', room: 'room-1' }),
    },
  ]);
  assert.deepEqual(sdk.busEvents, [
    { event: 'chat:delete:ChatMessage', payload: JSON.stringify('msg-1') },
  ]);
}

describe('deleteChatMessage', () => {
  let previousConfig: unknown;

  beforeEach(() => {
    previousConfig = ConfigController.getInstance().config;
    ConfigController.getInstance().config = {
      allowMessageDelete: true,
      auditMode: false,
    };
  });

  afterEach(() => {
    ConfigController.getInstance().config = previousConfig;
  });

  it('hard-deletes and broadcasts when auditMode is off', async () => {
    const sdk = createSdk(EXISTING_MESSAGE);

    await deleteChatMessage(sdk.grpcSdk, { messageId: 'msg-1', userId: 'user-1' });

    assert.deepEqual(sdk.finds, [
      { schemaName: 'ChatMessage', query: { _id: 'msg-1', deleted: false } },
    ]);
    assert.deepEqual(sdk.deletes, [
      { schemaName: 'ChatMessage', query: { _id: 'msg-1' } },
    ]);
    assert.equal(sdk.updates.length, 0);
    assertBroadcast(sdk);
  });

  it('marks the message deleted and broadcasts when auditMode is on', async () => {
    ConfigController.getInstance().config = { allowMessageDelete: true, auditMode: true };
    const sdk = createSdk(EXISTING_MESSAGE);

    await deleteChatMessage(sdk.grpcSdk, { messageId: 'msg-1', userId: 'user-1' });

    assert.deepEqual(sdk.updates, [
      { schemaName: 'ChatMessage', id: 'msg-1', document: { deleted: true } },
    ]);
    assert.equal(sdk.deletes.length, 0);
    assertBroadcast(sdk);
  });

  it('throws NOT_FOUND when the message is missing', async () => {
    const sdk = createSdk(null);

    await assert.rejects(
      () => deleteChatMessage(sdk.grpcSdk, { messageId: 'missing', userId: 'user-1' }),
      { code: status.NOT_FOUND, message: NOT_FOUND_OR_NO_ACCESS },
    );
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.deletes.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws NOT_FOUND when the acting user is not the sender', async () => {
    const sdk = createSdk(EXISTING_MESSAGE);

    await assert.rejects(
      () => deleteChatMessage(sdk.grpcSdk, { messageId: 'msg-1', userId: 'other-user' }),
      { code: status.NOT_FOUND, message: NOT_FOUND_OR_NO_ACCESS },
    );
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.deletes.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });

  it('throws FAILED_PRECONDITION and does not write when allowMessageDelete is false', async () => {
    ConfigController.getInstance().config = {
      allowMessageDelete: false,
      auditMode: false,
    };
    const sdk = createSdk(EXISTING_MESSAGE);

    await assert.rejects(
      () => deleteChatMessage(sdk.grpcSdk, { messageId: 'msg-1', userId: 'user-1' }),
      { code: status.FAILED_PRECONDITION, message: 'Message deletion is disabled' },
    );
    assert.equal(sdk.finds.length, 0);
    assert.equal(sdk.updates.length, 0);
    assert.equal(sdk.deletes.length, 0);
    assert.equal(sdk.socketPushes.length, 0);
    assert.equal(sdk.busEvents.length, 0);
  });
});
