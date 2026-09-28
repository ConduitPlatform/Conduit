import { describe, expect, it } from '@jest/globals';
import { ConduitDatabaseSchema } from '../interfaces/index.js';
import { resolveRelatedSchemas } from '../adapters/sequelize-adapter/utils/schema.js';

describe('resolveRelatedSchemas', () => {
  it('accepts a related model that exists but is not yet synced', async () => {
    const chatRoom = { synced: false };
    const models = {
      ChatRoom: chatRoom,
      ChatParticipantsLog: { synced: false },
    };
    const started = Date.now();
    const related = await resolveRelatedSchemas(
      { name: 'ChatParticipantsLog' } as ConduitDatabaseSchema,
      { chatRoom: { type: 'Relation', model: 'ChatRoom' } },
      models,
    );
    expect(Date.now() - started).toBeLessThan(400);
    expect(related.chatRoom).toBe(chatRoom);
  });

  it('resolves a cyclic peer that appears in models before sync', async () => {
    const chatRoom = { synced: false };
    const models: Record<string, { synced: boolean }> = { ChatRoom: chatRoom };
    const pending = resolveRelatedSchemas(
      { name: 'ChatRoom' } as ConduitDatabaseSchema,
      {
        participantsLog: [{ type: 'Relation', model: 'ChatParticipantsLog' }],
      },
      models,
    );
    const chatParticipantsLog = { synced: false };
    models.ChatParticipantsLog = chatParticipantsLog;
    await expect(pending).resolves.toEqual({
      participantsLog: [chatParticipantsLog],
    });
  });
});
