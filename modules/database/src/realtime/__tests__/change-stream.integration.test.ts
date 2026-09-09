import { describe, expect, it } from '@jest/globals';
import { MongoClient, ObjectId } from 'mongodb';
import { normalizeChangeEvent, type RawChangeEvent } from '../normalize.js';

const replicaSetUri = process.env.DB_CONN_URI;
const integrationEnabled = Boolean(replicaSetUri?.includes('replicaSet'));
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('MongoDB change stream contract', () => {
  it('normalizes insert events from a replica-set watch without document fields', async () => {
    const client = new MongoClient(replicaSetUri!);
    await client.connect();
    const dbName = `conduit_realtime_${Date.now()}`;
    const db = client.db(dbName);
    try {
      const collection = db.collection('orders');
      const stream = db.watch([]);
      const change = await new Promise<RawChangeEvent>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('timed out waiting for change')),
          10_000,
        );
        stream.on('change', event => {
          clearTimeout(timer);
          resolve(event as RawChangeEvent);
        });
        stream.on('error', err => {
          clearTimeout(timer);
          reject(err);
        });
        void collection.insertOne({ _id: new ObjectId(), secret: 'do-not-leak' });
      });
      await stream.close();
      const event = normalizeChangeEvent(change, 'Order');
      expect(event).toMatchObject({
        version: 1,
        operation: 'insert',
        schema: 'Order',
      });
      expect(event).not.toHaveProperty('fullDocument');
      expect(JSON.stringify(event)).not.toContain('do-not-leak');
    } finally {
      await db.dropDatabase().catch(() => undefined);
      await client.close();
    }
  });
});
