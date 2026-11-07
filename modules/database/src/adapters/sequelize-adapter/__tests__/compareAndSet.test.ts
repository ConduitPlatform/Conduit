import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataTypes, Sequelize, Transaction } from 'sequelize';
import { ConduitGrpcSdk, UpdateManyRequest } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema.js';
import { SequelizeAdapter } from '../index.js';
import { ConduitDatabaseSchema } from '../../../interfaces/index.js';
import { supportedSqlDialect } from '../utils/sqlTransaction.js';

const SOURCE = 'https://account.blob.core.windows.net/media/object?sig=keep';

function stamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number')
    return new Date(value).getTime();
  throw new Error(`missing timestamp ${String(value)}`);
}

function createSchema(
  sequelize: Sequelize,
  collectionName: string,
  fields: Record<string, { type: string }>,
  compiled: Record<string, unknown>,
) {
  const originalSchema = {
    name: collectionName,
    collectionName,
    fields,
    modelOptions: {},
  } as unknown as ConduitDatabaseSchema;
  return new SequelizeSchema(
    {} as ConduitGrpcSdk,
    sequelize,
    {
      collectionName,
      fields: compiled,
      modelOptions: { timestamps: true },
    },
    originalSchema,
    { sequelize } as unknown as SequelizeAdapter,
    {},
    {},
  );
}

describe('SQL compareAndSet', () => {
  let directory: string;
  let sequelize: Sequelize;
  let files: SequelizeSchema;
  let states: SequelizeSchema;
  const logged: string[] = [];

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'cdn-cas-'));
    logged.length = 0;
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: join(directory, 'cas.sqlite'),
      logging: sql => logged.push(sql),
      pool: { max: 5, min: 1, acquire: 10_000 },
    });
    sequelize.addHook('afterConnect', (connection: unknown) => {
      const db = connection as {
        run: (sql: string, cb: (err: Error | null) => void) => void;
      };
      return new Promise<void>((resolve, reject) => {
        db.run('PRAGMA busy_timeout = 8000', err => (err ? reject(err) : resolve()));
      });
    });
    files = createSchema(
      sequelize,
      'cdn_files',
      { url: { type: 'String' }, sourceUrl: { type: 'String' } },
      { url: { type: DataTypes.STRING }, sourceUrl: { type: DataTypes.STRING } },
    );
    states = createSchema(
      sequelize,
      'cdn_states',
      {
        container: { type: 'String' },
        fence: { type: 'Number' },
        status: { type: 'String' },
      },
      {
        container: { type: DataTypes.STRING },
        fence: { type: DataTypes.INTEGER },
        status: { type: DataTypes.STRING },
      },
    );
    await files.sync();
    await states.sync();
  });

  afterEach(async () => {
    if (sequelize) await sequelize.close();
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  async function seed(url = 'https://origin.example/a') {
    const file = await files.create({ url, sourceUrl: SOURCE });
    const state = await states.create({
      container: 'media',
      fence: 2,
      status: 'complete',
    });
    const storedFile = await files.findOne({ _id: file._id });
    const storedState = await states.findOne({ container: 'media' });
    return { file: storedFile, state: storedState, id: file._id as string };
  }

  it('refuses an unknown SQL dialect', () => {
    expect(() => supportedSqlDialect('mssql')).toThrow(
      /does not support SQL dialect mssql/,
    );
  });

  it('round-trips the guard fields on UpdateManyRequest', () => {
    const encoded = UpdateManyRequest.encode({
      schemaName: 'File',
      filterQuery: '{"_id":"file-00","url":"A"}',
      query: '{"url":"B"}',
      populate: [],
      guardSchema: '_StorageCdnState',
      guardFilter: '{"container":"media","fence":1}',
    }).finish();
    const decoded = UpdateManyRequest.decode(encoded);
    expect(decoded.guardSchema).toBe('_StorageCdnState');
    expect(decoded.guardFilter).toBe('{"container":"media","fence":1}');
    expect(decoded.filterQuery).toContain('"url":"A"');
  });

  it('keeps the url predicate in the UPDATE and rejects a stale url', async () => {
    const { id } = await seed('A');
    logged.length = 0;
    await files.updateOne({ _id: id, url: 'A' }, { url: 'B' });
    const update = logged.find(line => /update/i.test(line) && /where/i.test(line));
    expect(update).toBeDefined();
    expect(update).toMatch(/url/i);
    expect(update).toMatch(/_id/i);

    await expect(files.updateOne({ _id: id, url: 'A' }, { url: 'C' })).rejects.toThrow(
      'Document not found',
    );
    await expect(files.findOne({ _id: id })).resolves.toMatchObject({
      url: 'B',
      sourceUrl: SOURCE,
    });
  });

  it('lets only one of two overlapping url predicates succeed', async () => {
    const { id } = await seed('A');
    const results = await Promise.allSettled([
      files.updateOne({ _id: id, url: 'A' }, { url: 'B' }),
      files.updateOne({ _id: id, url: 'A' }, { url: 'C' }),
    ]);
    const applied = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    expect(applied).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toContain(
      'Document not found',
    );
    const row = await files.findOne({ _id: id });
    expect(['B', 'C']).toContain(row.url);
    expect(row.sourceUrl).toBe(SOURCE);
  });

  it('still applies $inc through the operator path', async () => {
    await states.create({ container: 'media', fence: 1, status: 'pending' });
    const updated = await states.updateOne(
      { container: 'media' },
      { $inc: { fence: 1 } },
    );
    expect(updated.fence).toBe(2);
  });

  it('updates a changed url under the current fence and leaves sourceUrl', async () => {
    const { id } = await seed('A');
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
    const { id, file, state } = await seed('A');
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

  it('rejects A→B after a newer owner skipped A, including a config rollback to A', async () => {
    const { id, file, state } = await seed('A');
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
    const created = await files.create({ url: 'A', sourceUrl: SOURCE });
    await states.create({ container: 'media', fence: 1, status: 'pending' });
    const id = created._id as string;
    const holder = await sequelize.transaction({ type: Transaction.TYPES.IMMEDIATE });
    const stale = files.compareAndSet(
      { _id: id, url: 'A' },
      { url: 'B' },
      { schema: states, filter: { container: 'media', fence: 1 } },
    );
    const claim = states.updateOne(
      { container: 'media', fence: 1 },
      { fence: 2, status: 'pending' },
    );
    const staleRace = await Promise.race([
      stale.then(value => ({ settled: true as const, value })),
      new Promise<{ settled: false }>(resolve =>
        setTimeout(() => resolve({ settled: false }), 400),
      ),
    ]);
    const claimRace = await Promise.race([
      claim.then(value => ({ settled: true as const, value })),
      new Promise<{ settled: false }>(resolve =>
        setTimeout(() => resolve({ settled: false }), 400),
      ),
    ]);
    expect(staleRace.settled).toBe(false);
    expect(claimRace.settled).toBe(false);
    await expect(states.findOne({ container: 'media' })).resolves.toMatchObject({
      status: 'pending',
      fence: 1,
    });
    await expect(files.findOne({ _id: id })).resolves.toMatchObject({ url: 'A' });

    await holder.commit();
    const staleResult = await stale;
    const claimResult = await claim;
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
