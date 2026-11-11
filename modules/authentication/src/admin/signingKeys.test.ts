import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { getConduitCode } from '@conduitplatform/grpc-sdk';
import { SIGNING_KEYS_LOCK, SigningKeysAdmin } from './signingKeys.js';
import { ensureSigning, emptySigning } from '../utils/signingKeys.logic.js';

function setup(opts: { mode?: string; persisted?: any; persistedNull?: boolean } = {}) {
  const signing = ensureSigning(emptySigning());
  const config: any = {
    accessTokens: { mode: opts.mode ?? 'jwt', expiryPeriod: 60_000, signing },
  };
  const calls = { persist: 0, sync: 0, publish: [] as string[], locks: [] as string[] };
  let now = 1_000_000;
  const admin = new SigningKeysAdmin({
    getConfig: () => config,
    readPersisted: async () =>
      opts.persistedNull ? null : (opts.persisted ?? { ...config }),
    persist: async next => {
      calls.persist += 1;
      config.accessTokens = next.accessTokens;
    },
    syncConfig: () => void (calls.sync += 1),
    publish: json => void calls.publish.push(json),
    withLock: async (resource, _ttl, fn) => {
      calls.locks.push(resource);
      return fn();
    },
    now: () => now,
  });
  const call = (force?: boolean) =>
    ({ request: { params: force ? { force } : {} } }) as any;
  return { admin, calls, config, signing, call, advance: (ms: number) => (now += ms) };
}

const code = (e: unknown) => (e as any)?.code;
const conduitCode = (e: unknown) => getConduitCode(e);

describe('SigningKeysAdmin.rotate', () => {
  it('rotates under the lock, persists, loads locally and publishes the full config', async () => {
    const t = setup();
    const res: any = await t.admin.rotate(t.call());
    assert.equal(res.previousKid, t.signing.kid);
    assert.notEqual(res.kid, t.signing.kid);
    assert.deepEqual(t.calls.locks, [SIGNING_KEYS_LOCK]);
    assert.equal(t.calls.persist, 1);
    assert.equal(t.calls.sync, 1);
    assert.equal(t.calls.publish.length, 1);
    const published = JSON.parse(t.calls.publish[0]);
    assert.equal(published.accessTokens.signing.kid, res.kid);
    assert.equal(published.accessTokens.signing.previousRetiredAt, 1_000_000 + 120_000);
  });
  it('refuses a second rotation while the previous key is active, unless forced', async () => {
    const t = setup();
    await t.admin.rotate(t.call());
    await assert.rejects(
      t.admin.rotate(t.call()),
      e =>
        code(e) === status.FAILED_PRECONDITION &&
        conduitCode(e) === 'PREVIOUS_SIGNING_KEY_ACTIVE',
    );
    assert.equal(t.calls.persist, 1);
    const forced: any = await t.admin.rotate(t.call(true));
    assert.ok(forced.kid);
    assert.equal(t.calls.persist, 2);
  });
  it('allows rotation once the previous key has retired', async () => {
    const t = setup();
    await t.admin.rotate(t.call());
    t.advance(120_001);
    await t.admin.rotate(t.call());
    assert.equal(t.calls.persist, 2);
  });
  it('is refused in session mode and when the persisted config is unreadable', async () => {
    const s = setup({ mode: 'session' });
    await assert.rejects(
      s.admin.rotate(s.call()),
      e =>
        code(e) === status.FAILED_PRECONDITION &&
        conduitCode(e) === 'SIGNING_KEYS_NOT_APPLICABLE',
    );
    const u = setup({ persistedNull: true });
    await assert.rejects(
      u.admin.rotate(u.call()),
      e =>
        code(e) === status.UNAVAILABLE &&
        conduitCode(e) === 'AUTH_CONFIG_PERSISTENCE_UNAVAILABLE',
    );
    assert.equal(u.calls.persist, 0);
  });
  it('uses the persisted block (a peer may have rotated) for the previous-key check', async () => {
    const t = setup();
    const peer = {
      accessTokens: {
        signing: { ...t.signing, previousRetiredAt: 2_000_000, previousPublicKey: 'x' },
      },
    };
    const p = setup({ persisted: peer });
    await assert.rejects(
      p.admin.rotate(p.call()),
      e => code(e) === status.FAILED_PRECONDITION,
    );
  });
});
