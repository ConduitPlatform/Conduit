import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import magicLinkConfig, { MAGIC_LINK_TTL_MS } from '../config/magicLink.config.js';
import { TokenType } from '../constants/TokenType.js';
import {
  issueMagicLinkToken,
  magicLinkExpired,
  redeemMagicLink,
} from './magicLink.logic.js';

type Row = {
  _id: string;
  tokenType: string;
  user: string;
  token: string;
  data?: any;
  expiresAt?: Date;
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
    async deleteMany(query: { user: string; tokenType: string }) {
      await tick();
      if (failDelete) throw new Error('write failed');
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row.user === query.user && row.tokenType === query.tokenType)
          rows.splice(i, 1);
      }
      return { deletedCount: before - rows.length };
    },
    async create(doc: Omit<Row, '_id'>) {
      await tick();
      const row: Row = { _id: `t${(nextId += 1)}`, ...doc };
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

function issue(store: ReturnType<typeof createStore>, token: string, now: number) {
  return issueMagicLinkToken({
    userId: 'user-1',
    token,
    data: { clientId: 'web' },
    ttlMs: MAGIC_LINK_TTL_MS,
    now,
    deleteMany: query => store.deleteMany(query),
    create: doc => store.create(doc),
  });
}

/**
 * Same consume used by POST /magic-link/:magicToken and GET /hook/magic-link/:verificationToken.
 * `path` only labels which route issued the session.
 */
function redeem(
  store: ReturnType<typeof createStore>,
  magicToken: string,
  path: 'exchange' | 'hook',
  sessions: string[],
  now = Date.now(),
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
});
