export type SubscriptionStore = {
  sadd(key: string, ...members: string[]): Promise<unknown>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  scard(key: string): Promise<number>;
  del(...keys: string[]): Promise<unknown>;
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
    await this.store.sadd(
      socketKey(socketId),
      subscriptionRecord(schema, documentId, userId),
    );
    await this.store.sadd(userDocSocketsKey(schema, documentId, userId), socketId);
    await this.store.sadd(docUsersKey(schema, documentId), userId);
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
}
