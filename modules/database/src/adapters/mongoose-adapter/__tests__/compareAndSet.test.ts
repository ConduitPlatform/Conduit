import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ConduitGrpcSdk, ConduitSchema } from '@conduitplatform/grpc-sdk';
import { MongooseSchema } from '../MongooseSchema.js';
import { MongooseAdapter } from '../index.js';

const SOURCE = 'https://account.blob.core.windows.net/media/object?sig=keep';

function stamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number')
    return new Date(value).getTime();
  throw new Error(`missing timestamp ${String(value)}`);
}

function schema(name: string, fields: Record<string, unknown>) {
  return {
    name,
    collectionName: name,
    fields,
    modelOptions: { timestamps: true },
  } as unknown as ConduitSchema;
}

describe('Mongo compareAndSet', () => {
  let replSet: MongoMemoryReplSet;
  let files: MongooseSchema;
  let states: MongooseSchema;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replSet.getUri(), { dbName: 'cdn_cas' });
    const adapter = {
      getQueryDefaults: () => ({
        writeConcern: '1',
        readPreference: 'primary',
        readConcern: 'local',
      }),
    } as unknown as MongooseAdapter;
    const fileSchema = schema('CdnFileCas', {
      url: { type: String },
      sourceUrl: { type: String },
    });
    const stateSchema = schema('CdnStateCas', {
      container: { type: String },
      fence: { type: Number },
      status: { type: String },
    });
    files = new MongooseSchema(
      {} as ConduitGrpcSdk,
      mongoose,
      fileSchema,
      { ...fileSchema, modelOptions: {} },
      adapter,
    );
    states = new MongooseSchema(
      {} as ConduitGrpcSdk,
      mongoose,
      stateSchema,
      { ...stateSchema, modelOptions: {} },
      adapter,
    );
  }, 180_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    await files.model.deleteMany({});
    await states.model.deleteMany({});
  });

  async function seed(url = 'A', fence = 2, status = 'complete') {
    const file = await files.create({ url, sourceUrl: SOURCE });
    await states.create({ container: 'media', fence, status });
    const storedFile = await files.findOne({ _id: file._id });
    const storedState = await states.findOne({ container: 'media' });
    return { id: file._id, file: storedFile, state: storedState };
  }

  it('lets only one of two overlapping url predicates succeed', async () => {
    const { id } = await seed('A');
    const results = await Promise.allSettled([
      files.updateOne({ _id: id, url: 'A' }, { url: 'B' }),
      files.updateOne({ _id: id, url: 'A' }, { url: 'C' }),
    ]);
    const applied = results.flatMap(result => {
      if (result.status === 'rejected') {
        expect(String(result.reason)).toContain('Document not found');
        return [];
      }
      return result.value?.url ? [result.value.url as string] : [];
    });
    expect(applied).toHaveLength(1);
    const row = await files.findOne({ _id: id });
    expect(['B', 'C']).toContain(row.url);
    expect(row.sourceUrl).toBe(SOURCE);
  });

  it('updates a changed url under the current fence and leaves sourceUrl', async () => {
    const { id } = await seed();
    const written = await files.compareAndSet(
      { _id: id, url: 'A' },
      { url: 'B' },
      { schema: states, filter: { container: 'media', fence: 2 } },
    );
    expect(written.url).toBe('B');
    expect(written.sourceUrl).toBe(SOURCE);
    await expect(states.findOne({ container: 'media' })).resolves.toMatchObject({
      fence: 2,
      status: 'complete',
    });
  });

  it('returns no match for a stale fence or a stale url and does not change timestamps', async () => {
    const { id, file, state } = await seed();
    const missedFence = await files.compareAndSet(
      { _id: id, url: 'A' },
      { url: 'B' },
      { schema: states, filter: { container: 'media', fence: 1 } },
    );
    expect(missedFence).toBeNull();
    const afterFence = await files.findOne({ _id: id });
    const afterState = await states.findOne({ container: 'media' });
    expect(afterFence.url).toBe('A');
    expect(stamp(afterFence.updatedAt)).toBe(stamp(file.updatedAt));
    expect(stamp(afterState.updatedAt)).toBe(stamp(state.updatedAt));

    const missedUrl = await files.compareAndSet(
      { _id: id, url: 'B' },
      { url: 'C' },
      { schema: states, filter: { container: 'media', fence: 2 } },
    );
    expect(missedUrl).toBeNull();
    const afterUrl = await files.findOne({ _id: id });
    const stateAfterUrl = await states.findOne({ container: 'media' });
    expect(afterUrl.url).toBe('A');
    expect(stamp(afterUrl.updatedAt)).toBe(stamp(file.updatedAt));
    expect(stamp(stateAfterUrl.updatedAt)).toBe(stamp(state.updatedAt));
  });

  it('rejects A→B after a newer owner skipped A', async () => {
    const { id, file, state } = await seed();
    const stale = await files.compareAndSet(
      { _id: id, url: 'A' },
      { url: 'B' },
      { schema: states, filter: { container: 'media', fence: 1 } },
    );
    expect(stale).toBeNull();
    const stored = await files.findOne({ _id: id });
    const storedState = await states.findOne({ container: 'media' });
    expect(stored.url).toBe('A');
    expect(stored.sourceUrl).toBe(SOURCE);
    expect(stamp(stored.updatedAt)).toBe(stamp(file.updatedAt));
    expect(storedState.fence).toBe(2);
    expect(storedState.status).toBe('complete');
    expect(stamp(storedState.updatedAt)).toBe(stamp(state.updatedAt));
  });

  it('does not record completion while a stale guarded write can still change the file', async () => {
    const { id } = await seed('A', 1, 'pending');
    const session = await mongoose.startSession();
    session.startTransaction();
    await states.model.updateOne(
      { container: 'media' },
      { $currentDate: { updatedAt: true } },
      { session },
    );
    const stale = files.compareAndSet(
      { _id: id, url: 'A' },
      { url: 'B' },
      { schema: states, filter: { container: 'media', fence: 1 } },
    );
    const claim = states.updateOne(
      { container: 'media', fence: 1 },
      { fence: 2, status: 'pending' },
    );
    const blocked = await Promise.race([
      Promise.allSettled([stale, claim]).then(() => 'settled' as const),
      new Promise<'blocked'>(resolve => setTimeout(() => resolve('blocked'), 500)),
    ]);
    expect(blocked).toBe('blocked');
    await expect(states.findOne({ container: 'media' })).resolves.toMatchObject({
      status: 'pending',
      fence: 1,
    });
    await expect(files.findOne({ _id: id })).resolves.toMatchObject({ url: 'A' });

    await session.commitTransaction();
    await session.endSession();
    const [staleResult, claimResult] = await Promise.all([stale, claim]);
    let url = (await files.findOne({ _id: id })).url as string;
    expect(claimResult.fence).toBe(2);
    if (staleResult) {
      expect(url).toBe('B');
      const corrected = await files.compareAndSet(
        { _id: id, url: 'B' },
        { url: 'A' },
        { schema: states, filter: { container: 'media', fence: 2 } },
      );
      expect(corrected.url).toBe('A');
      url = corrected.url;
    } else {
      expect(url).toBe('A');
    }
    await expect(states.findOne({ container: 'media' })).resolves.toMatchObject({
      status: 'pending',
    });
    await states.updateOne({ container: 'media', fence: 2 }, { status: 'complete' });
    const late = await files.compareAndSet(
      { _id: id, url: 'A' },
      { url: 'B' },
      { schema: states, filter: { container: 'media', fence: 1 } },
    );
    expect(late).toBeNull();
    expect(url).toBe('A');
    await expect(files.findOne({ _id: id })).resolves.toMatchObject({
      url: 'A',
      sourceUrl: SOURCE,
    });
    await expect(states.findOne({ container: 'media' })).resolves.toMatchObject({
      status: 'complete',
      fence: 2,
    });
  });
});
