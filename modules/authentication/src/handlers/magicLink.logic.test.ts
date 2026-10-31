import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import magicLinkConfig, { MAGIC_LINK_TTL_MS } from '../config/magicLink.config.js';
import { TokenType } from '../constants/TokenType.js';
import {
  expiredMagicLinksQuery,
  issueMagicLinkToken,
  MAGIC_LINK_MAX_TTL_MS,
  magicLinkExpired,
  magicLinkExpiryError,
  redeemMagicLink,
} from './magicLink.logic.js';

type Row = {
  _id: string;
  tokenType: string;
  user: string;
  token: string;
  data?: any;
  expiresAt?: Date;
  createdAt: Date;
};

type OlderTokensQuery = {
  user: string;
  tokenType: string;
  _id: { $ne: string };
  createdAt: { $lt: Date };
};

function createStore() {
  const rows: Row[] = [];
  let nextId = 0;
  let failDelete = false;
  const tick = () => new Promise(resolve => setImmediate(resolve));
  return {
    rows,
    setFailDelete(value: boolean) {
      failDelete = value;
    },
    async deleteMany(query: OlderTokensQuery) {
      await tick();
      if (failDelete) throw new Error('write failed');
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (
          row.user === query.user &&
          row.tokenType === query.tokenType &&
          row._id !== query._id.$ne &&
          row.createdAt < query.createdAt.$lt
        )
          rows.splice(i, 1);
      }
      return { deletedCount: before - rows.length };
    },
    async create(doc: Omit<Row, '_id' | 'createdAt'>) {
      await tick();
      nextId += 1;
      const row: Row = {
        _id: `t${nextId}`,
        createdAt: new Date(1_600_000_000_000 + nextId),
        ...doc,
      };
      rows.push(row);
      return row;
    },
    async findToken(token: string) {
      await tick();
      return (
        rows.find(row => row.tokenType === TokenType.MAGIC_LINK && row.token === token) ??
        null
      );
    },
    async deleteOne(query: { _id: string; user: string; tokenType: string }) {
      await tick();
      if (failDelete) throw new Error('write failed');
      const index = rows.findIndex(
        row =>
          row._id === query._id &&
          row.user === query.user &&
          row.tokenType === query.tokenType,
      );
      if (index < 0) return { deletedCount: 0 };
      rows.splice(index, 1);
      return { deletedCount: 1 };
    },
  };
}

function issue(
  store: ReturnType<typeof createStore>,
  token: string,
  now: number,
  deliver: (row: Row) => Promise<unknown> = async () => undefined,
) {
  return issueMagicLinkToken({
    userId: 'user-1',
    token,
    data: { clientId: 'web' },
    ttlMs: MAGIC_LINK_TTL_MS,
    now,
    create: doc => store.create(doc),
    deliver,
    deleteMany: query => store.deleteMany(query),
  });
}

function redeem(
  store: ReturnType<typeof createStore>,
  magicToken: string,
  path: 'exchange' | 'hook',
  sessions: string[],
  now = Date.now(),
  failSession = false,
) {
  return redeemMagicLink({
    magicToken,
    now,
    findToken: token => store.findToken(token),
    deleteOne: query => store.deleteOne(query),
    loadUser: async token => ({ _id: String(token.user) }),
    resolveRealm: async () => null,
    admit: async () => true,
    issueSession: async () => {
      if (failSession) throw new Error('session failed');
      sessions.push(path);
      return path;
    },
  });
}

describe('magic link config', () => {
  it('defaults the lifetime to 3 minutes', () => {
    const config = convict(magicLinkConfig);
    assert.equal(MAGIC_LINK_TTL_MS, 3 * 60 * 1000);
    assert.equal(config.get('magic_link.expiry_period'), MAGIC_LINK_TTL_MS);
  });

  it('accepts whole milliseconds from 1 to one day', () => {
    for (const value of [undefined, 1, MAGIC_LINK_TTL_MS, MAGIC_LINK_MAX_TTL_MS]) {
      assert.equal(magicLinkExpiryError(value), null);
    }
  });

  it('rejects non-positive, fractional, oversized and non-numeric lifetimes', () => {
    for (const value of [0, -1, 1.5, MAGIC_LINK_MAX_TTL_MS + 1, NaN, '180000', null]) {
      assert.match(magicLinkExpiryError(value) ?? '', /magic_link\.expiry_period/);
    }
  });
});

describe('magic link issue', () => {
  const now = 1_700_000_000_000;

  it('creates and delivers the new token before deleting older ones', async () => {
    const store = createStore();
    const older = await issue(store, 'older', now);
    const steps: string[] = [];
    await issue(store, 'newer', now, async row => {
      steps.push(`deliver ${row.token}`);
      assert.deepEqual(
        store.rows.map(r => r.token),
        ['older', 'newer'],
      );
    });
    assert.deepEqual(steps, ['deliver newer']);
    assert.deepEqual(
      store.rows.map(r => r.token),
      ['newer'],
    );
    assert.equal(
      store.rows.some(r => r._id === older._id),
      false,
    );
  });

  it('keeps the older link when delivery of the new one fails', async () => {
    const store = createStore();
    await issue(store, 'older', now);
    await assert.rejects(() =>
      issue(store, 'newer', now, async () => {
        throw new Error('mail down');
      }),
    );
    const sessions: string[] = [];
    assert.equal(await redeem(store, 'older', 'hook', sessions, now), 'hook');
  });

  it('leaves the newest link of two concurrent requests', async () => {
    const store = createStore();
    const [first, second] = await Promise.all([
      issue(store, 'first', now),
      issue(store, 'second', now),
    ]);
    assert.deepEqual(
      store.rows.map(r => r._id),
      [second._id],
    );
    assert.ok(first.createdAt < second.createdAt);
  });

  it('sets expiresAt from the configured lifetime', async () => {
    const store = createStore();
    const created = await issue(store, 'tok', now);
    assert.equal(created.expiresAt?.getTime(), now + MAGIC_LINK_TTL_MS);
  });
});

describe('expired magic link cleanup', () => {
  it('targets expired and expiry-less magic links only', () => {
    const now = new Date(1_700_000_000_000);
    assert.deepEqual(expiredMagicLinksQuery(now), {
      tokenType: TokenType.MAGIC_LINK,
      $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
    });
  });
});

describe('magic link redeem', () => {
  const now = 1_700_000_000_000;

  it('lets exactly one of two simultaneous redeems succeed', async () => {
    const store = createStore();
    const created = await issue(store, 'tok', now);
    const sessions: string[] = [];
    const results = await Promise.allSettled([
      redeem(store, created.token, 'exchange', sessions, now),
      redeem(store, created.token, 'hook', sessions, now),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal(sessions.length, 1);
    assert.equal(store.rows.length, 0);
  });

  it('rejects reuse after a redeem', async () => {
    const store = createStore();
    const created = await issue(store, 'tok', now);
    const sessions: string[] = [];
    assert.equal(
      await redeem(store, created.token, 'exchange', sessions, now),
      'exchange',
    );
    await assert.rejects(
      () => redeem(store, created.token, 'hook', sessions, now),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.NOT_FOUND &&
        err.message === 'Magic link token does not exist',
    );
    assert.deepEqual(sessions, ['exchange']);
  });

  it('rejects an expired token without issuing a session', async () => {
    const store = createStore();
    const created = await issue(store, 'tok', now);
    const sessions: string[] = [];
    await assert.rejects(
      () => redeem(store, created.token, 'hook', sessions, now + MAGIC_LINK_TTL_MS),
      (err: unknown) => err instanceof GrpcError && err.code === status.NOT_FOUND,
    );
    assert.deepEqual(sessions, []);
    assert.equal(magicLinkExpired(created.expiresAt, now + MAGIC_LINK_TTL_MS), true);
    assert.equal(magicLinkExpired(created.expiresAt, now + MAGIC_LINK_TTL_MS - 1), false);
  });

  it('rejects a token that has no expiry', async () => {
    const store = createStore();
    store.rows.push({
      _id: 'old',
      tokenType: TokenType.MAGIC_LINK,
      user: 'user-1',
      token: 'legacy',
      data: { clientId: 'web' },
      createdAt: new Date(0),
    });
    const sessions: string[] = [];
    await assert.rejects(
      () => redeem(store, 'legacy', 'exchange', sessions, now),
      (err: unknown) => err instanceof GrpcError && err.code === status.NOT_FOUND,
    );
    assert.deepEqual(sessions, []);
  });

  it('rejects a superseded token and accepts the newest one', async () => {
    const store = createStore();
    store.rows.push({
      _id: 'other',
      tokenType: TokenType.VERIFICATION_TOKEN,
      user: 'user-1',
      token: 'keep-me',
      createdAt: new Date(0),
    });
    const first = await issue(store, 'older', now);
    const second = await issue(store, 'newer', now);
    const sessions: string[] = [];
    await assert.rejects(
      () => redeem(store, first.token, 'exchange', sessions, now),
      (err: unknown) => err instanceof GrpcError && err.code === status.NOT_FOUND,
    );
    assert.equal(await redeem(store, second.token, 'hook', sessions, now), 'hook');
    assert.deepEqual(sessions, ['hook']);
    assert.deepEqual(
      store.rows.map(row => row.token),
      ['keep-me'],
    );
  });

  it('does not issue a session when the delete fails', async () => {
    const store = createStore();
    const created = await issue(store, 'tok', now);
    store.setFailDelete(true);
    const sessions: string[] = [];
    await assert.rejects(() => redeem(store, created.token, 'exchange', sessions, now));
    assert.deepEqual(sessions, []);
    assert.equal(store.rows.length, 1);
    store.setFailDelete(false);
    assert.equal(await redeem(store, created.token, 'hook', sessions, now), 'hook');
    assert.deepEqual(sessions, ['hook']);
  });

  it('consumes the token before issuing a session, so a failed session cannot be retried', async () => {
    const store = createStore();
    const created = await issue(store, 'tok', now);
    const sessions: string[] = [];
    await assert.rejects(
      () => redeem(store, created.token, 'exchange', sessions, now, true),
      /session failed/,
    );
    assert.equal(store.rows.length, 0);
    await assert.rejects(
      () => redeem(store, created.token, 'hook', sessions, now),
      (err: unknown) => err instanceof GrpcError && err.code === status.NOT_FOUND,
    );
    assert.deepEqual(sessions, []);
  });
});
