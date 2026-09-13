export const RECOVERY_REDIS_TTL_SECONDS = 120;

export type SubscriptionStore = {
  sadd(key: string, ...members: string[]): Promise<unknown>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  scard(key: string): Promise<number>;
  del(...keys: string[]): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  persist(key: string): Promise<unknown>;
};

function socketKey(socketId: string): string {
  return `realtime:socket:${socketId}`;
}

function docUsersKey(schema: string, documentId: string): string {
  return `realtime:doc:${schema}:${documentId}`;
}

function userDocSocketsKey(schema: string, documentId: string, userId: string): string {
  return `realtime:userdoc:${schema}:${documentId}:${userId}`;
}

function subscriptionRecord(schema: string, documentId: string, userId: string): string {
  return JSON.stringify({ schema, documentId, userId });
}

export class RealtimeSubscriptionTracker {
  constructor(private readonly store: SubscriptionStore) {}

  async addAuthorizedDocument(
    socketId: string,
    schema: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    const socket = socketKey(socketId);
    const userDoc = userDocSocketsKey(schema, documentId, userId);
    const docUsers = docUsersKey(schema, documentId);
    await this.store.sadd(socket, subscriptionRecord(schema, documentId, userId));
    await this.store.sadd(userDoc, socketId);
    await this.store.sadd(docUsers, userId);
    await this.store.persist(socket);
    await this.store.persist(userDoc);
    await this.store.persist(docUsers);
  }

  async removeAuthorizedDocument(
    socketId: string,
    schema: string,
    documentId: string,
    userId: string,
  ): Promise<void> {
    await this.store.srem(
      socketKey(socketId),
      subscriptionRecord(schema, documentId, userId),
    );
    await this.store.srem(userDocSocketsKey(schema, documentId, userId), socketId);
    const remaining = await this.store.scard(
      userDocSocketsKey(schema, documentId, userId),
    );
    if (remaining === 0) {
      await this.store.srem(docUsersKey(schema, documentId), userId);
      await this.store.del(userDocSocketsKey(schema, documentId, userId));
    }
  }

  async listUsers(schema: string, documentId: string): Promise<string[]> {
    return this.store.smembers(docUsersKey(schema, documentId));
  }

  async removeUser(schema: string, documentId: string, userId: string): Promise<void> {
    await this.store.srem(docUsersKey(schema, documentId), userId);
    await this.store.del(userDocSocketsKey(schema, documentId, userId));
  }

  async disconnect(socketId: string): Promise<void> {
    const records = await this.store.smembers(socketKey(socketId));
    for (const record of records) {
      try {
        const parsed = JSON.parse(record) as {
          schema: string;
          documentId: string;
          userId: string;
        };
        await this.removeAuthorizedDocument(
          socketId,
          parsed.schema,
          parsed.documentId,
          parsed.userId,
        );
      } catch {
        // ignore malformed records
      }
    }
    await this.store.del(socketKey(socketId));
  }

  async armRecoverableTtl(
    socketId: string,
    ttlSeconds: number = RECOVERY_REDIS_TTL_SECONDS,
  ): Promise<void> {
    const socket = socketKey(socketId);
    const records = await this.store.smembers(socket);
    await this.store.expire(socket, ttlSeconds);
    for (const record of records) {
      try {
        const parsed = JSON.parse(record) as {
          schema: string;
          documentId: string;
          userId: string;
        };
        const userDoc = userDocSocketsKey(
          parsed.schema,
          parsed.documentId,
          parsed.userId,
        );
        const others = (await this.store.smembers(userDoc)).filter(id => id !== socketId);
        if (others.length > 0) continue;
        await this.store.expire(userDoc, ttlSeconds);
        const users = await this.store.smembers(
          docUsersKey(parsed.schema, parsed.documentId),
        );
        if (users.length <= 1) {
          await this.store.expire(
            docUsersKey(parsed.schema, parsed.documentId),
            ttlSeconds,
          );
        }
      } catch {
        // ignore malformed records
      }
    }
  }
}
