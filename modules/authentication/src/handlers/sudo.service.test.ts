import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { performSudo, SudoDeps, SudoUserRecord } from './sudo.service.js';

function harness(user: Partial<SudoUserRecord> = {}) {
  const store = new Map<string, string>();
  const calls = { sms: 0, minted: 0 };
  let now = 1_000_000;
  const u: SudoUserRecord = {
    _id: 'u1',
    active: true,
    hasTwoFA: false,
    hashedPassword: 'hash',
    ...user,
  };
  const deps: SudoDeps<SudoUserRecord> = {
    state: {
      getKey: async k => store.get(k) ?? null,
      setKey: async (k, v) => void store.set(k, v),
      clearKey: async k => void store.delete(k),
      setIfAbsent: async (k, v) => {
        if (store.has(k)) return false;
        store.set(k, v);
        return true;
      },
    },
    now: () => now,
    loadUser: async () => u,
    checkPassword: async (pw, hashed) => pw === 'good' && hashed === 'hash',
    getTotpSecret: async () => 'secret',
    verifyTotp: (_s, code) => (code === '111111' ? 0 : code === '222222' ? -1 : null),
    sendSmsChallenge: async () => void (calls.sms += 1),
    verifySms: async (_u, code) => code === '999999',
    mint: async () => {
      calls.minted += 1;
      return { accessToken: 'tok' };
    },
  };
  return { deps, store, calls, advance: (ms: number) => (now += ms) };
}

const code = (e: unknown) => (e instanceof GrpcError ? e.code : undefined);

describe('performSudo', () => {
  it('no 2FA + good password mints; bad password fails', async () => {
    const h = harness();
    assert.deepEqual(await performSudo(h.deps, { password: 'good' }), {
      accessToken: 'tok',
    });
    await assert.rejects(
      performSudo(h.deps, { password: 'bad' }),
      e => code(e) === status.UNAUTHENTICATED,
    );
  });
  it('2FA user cannot step up with a password alone', async () => {
    const h = harness({ hasTwoFA: true, twoFaMethod: 'authenticator' });
    await assert.rejects(
      performSudo(h.deps, { password: 'good' }),
      e => code(e) === status.INVALID_ARGUMENT,
    );
    assert.equal(h.calls.minted, 0);
  });
  it('TOTP user: code required; code mints; bad password with good code fails', async () => {
    const h = harness({ hasTwoFA: true, twoFaMethod: 'authenticator' });
    assert.deepEqual(await performSudo(h.deps, { code: '111111' }), {
      accessToken: 'tok',
    });
    h.advance(31_000);
    await assert.rejects(
      performSudo(h.deps, { code: '111111', password: 'bad' }),
      e => code(e) === status.UNAUTHENTICATED,
    );
    await assert.rejects(
      performSudo(h.deps, { code: '000000' }),
      e => code(e) === status.UNAUTHENTICATED,
    );
  });
  it('TOTP replay within the window is rejected', async () => {
    const h = harness({ hasTwoFA: true, twoFaMethod: 'authenticator' });
    await performSudo(h.deps, { code: '111111' });
    await assert.rejects(
      performSudo(h.deps, { code: '111111' }),
      e => code(e) === status.UNAUTHENTICATED,
    );
    // an older step is a replay too
    await assert.rejects(
      performSudo(h.deps, { code: '222222' }),
      e => code(e) === status.UNAUTHENTICATED,
    );
    assert.equal(h.calls.minted, 1);
    // after the next step a fresh code works
    h.advance(31_000);
    assert.deepEqual(await performSudo(h.deps, { code: '111111' }), {
      accessToken: 'tok',
    });
  });
  it('two concurrent requests with one TOTP code mint once (atomic claim)', async () => {
    const h = harness({ hasTwoFA: true, twoFaMethod: 'authenticator' });
    const results = await Promise.allSettled([
      performSudo(h.deps, { code: '111111' }),
      performSudo(h.deps, { code: '111111' }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(h.calls.minted, 1);
  });
  it('SMS: challenge without a code, verify with the code', async () => {
    const h = harness({ hasTwoFA: true, twoFaMethod: 'sms' });
    assert.deepEqual(await performSudo(h.deps, {}), { challenge: 'sms' });
    assert.equal(h.calls.sms, 1);
    assert.equal(h.calls.minted, 0);
    await assert.rejects(
      performSudo(h.deps, { code: '123' }),
      e => code(e) === status.UNAUTHENTICATED,
    );
    assert.deepEqual(await performSudo(h.deps, { code: '999999' }), {
      accessToken: 'tok',
    });
  });
  it('locks after 5 failures, even for the right credentials, then recovers', async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) {
      await assert.rejects(performSudo(h.deps, { password: 'bad' }));
    }
    await assert.rejects(
      performSudo(h.deps, { password: 'good' }),
      e => code(e) === status.RESOURCE_EXHAUSTED,
    );
    h.advance(15 * 60_000 + 1);
    assert.deepEqual(await performSudo(h.deps, { password: 'good' }), {
      accessToken: 'tok',
    });
  });
  it('success clears the failure counter', async () => {
    const h = harness();
    for (let i = 0; i < 4; i++)
      await assert.rejects(performSudo(h.deps, { password: 'bad' }));
    await performSudo(h.deps, { password: 'good' });
    for (let i = 0; i < 4; i++)
      await assert.rejects(performSudo(h.deps, { password: 'bad' }));
    assert.deepEqual(await performSudo(h.deps, { password: 'good' }), {
      accessToken: 'tok',
    });
  });
  it('fails closed without a state store and for blocked users', async () => {
    const h = harness();
    await assert.rejects(
      performSudo({ ...h.deps, state: null }, { password: 'good' }),
      e => code(e) === status.UNAVAILABLE,
    );
    const b = harness({ active: false });
    await assert.rejects(
      performSudo(b.deps, { password: 'good' }),
      e => code(e) === status.PERMISSION_DENIED,
    );
  });
});
