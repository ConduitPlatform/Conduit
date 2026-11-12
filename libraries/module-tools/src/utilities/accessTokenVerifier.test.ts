import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createSigner } from 'fast-jwt';
import { AccessTokenVerifier } from '../../dist/index.esm.js';

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
};
const k1 = pair();
const k2 = pair();

const cfg = (over: any = {}, signing: any = {}) => ({
  accessTokens: {
    mode: 'jwt',
    tokenVersion: 1,
    strictRevocation: true,
    signing: { kid: 'a', publicKey: k1.publicKey, previousRetiredAt: 0, ...signing },
    ...over,
  },
});

const token = (key: string, kid: string) =>
  createSigner({ algorithm: 'EdDSA', key, kid })({
    sub: 'u',
    sid: 's',
    cid: 'c',
    authorized: true,
    sudo: false,
    tv: 1,
    exp: Math.floor(Date.now() / 1000) + 60,
    iat: 0,
    iss: 'x',
  });

function fakeSdk(opts: { getConfig?: () => Promise<any> } = {}) {
  const calls = { get: 0, subscribe: 0, unsubscribe: 0 };
  let cb: ((m: string) => void) | undefined;
  const sdk: any = {
    config: {
      get: async () => {
        calls.get++;
        return opts.getConfig ? opts.getConfig() : cfg();
      },
    },
    bus: {
      subscribeAck: async (_c: string, f: (m: string) => void) => {
        calls.subscribe++;
        cb = f;
      },
      unsubscribe: () => {
        calls.unsubscribe++;
      },
    },
  };
  return { sdk, calls, emit: (m: unknown) => cb!(JSON.stringify(m)) };
}

describe('AccessTokenVerifier', () => {
  beforeEach(() => AccessTokenVerifier.resetForTests());
  afterEach(() => AccessTokenVerifier.resetForTests());

  it('applyConfig sets getters and verifies', () => {
    const v = AccessTokenVerifier.getInstance(fakeSdk().sdk);
    assert.equal(v.ready, false);
    assert.throws(
      () => v.verify('x'),
      (e: any) => e.code === 16,
    );
    v.applyConfig(cfg());
    assert.equal(v.ready, true);
    assert.equal(v.mode, 'jwt');
    assert.equal(v.tokenVersion, 1);
    assert.equal(v.strictRevocation, true);
    assert.equal(v.verify(token(k1.privateKey, 'a')).sub, 'u');
  });

  it('keeps previous state on invalid keys or missing accessTokens', () => {
    const v = AccessTokenVerifier.getInstance(fakeSdk().sdk);
    v.applyConfig(cfg());
    v.applyConfig(cfg({}, { publicKey: 'not a pem' }));
    v.applyConfig({});
    assert.equal(v.verify(token(k1.privateKey, 'a')).sub, 'u');
  });

  it('fails closed on NaN tokenVersion', () => {
    const v = AccessTokenVerifier.getInstance(fakeSdk().sdk);
    v.applyConfig(cfg({ tokenVersion: 'abc' }));
    assert.throws(
      () => v.verify(token(k1.privateKey, 'a')),
      (e: any) =>
        e.conduitCode === 'TOKEN_REVOKED' && e.debugLogInfo === 'version mismatch',
    );
  });

  it('start loads config and applies bus updates', async () => {
    const f = fakeSdk();
    const v = AccessTokenVerifier.getInstance(f.sdk);
    await v.start();
    assert.equal(v.ready, true);
    assert.throws(
      () => v.verify(token(k2.privateKey, 'b')),
      (e: any) => e.conduitCode === 'TOKEN_INVALID' && e.debugLogInfo === 'unknown kid',
    );
    f.emit(
      cfg(
        {},
        {
          kid: 'b',
          publicKey: k2.publicKey,
          previousKid: 'a',
          previousPublicKey: k1.publicKey,
          previousRetiredAt: Date.now() + 60000,
        },
      ),
    );
    assert.equal(v.verify(token(k2.privateKey, 'b')).sub, 'u');
    assert.equal(v.verify(token(k1.privateKey, 'a')).sub, 'u');
    v.stop();
  });

  it('stops retrying once loaded in session mode without keys', async () => {
    const f = fakeSdk({
      getConfig: async () => ({ accessTokens: { mode: 'session', tokenVersion: 0 } }),
    });
    const v = AccessTokenVerifier.getInstance(f.sdk);
    await v.start();
    assert.equal(v.mode, 'session');
    assert.equal(v.ready, false);
    await new Promise(r => setTimeout(r, 50));
    assert.equal(f.calls.get, 1);
    v.stop();
  });

  it('start never throws, concurrent starts share one chain, stop cleans up', async () => {
    const f = fakeSdk({
      getConfig: async () => {
        throw new Error('down');
      },
    });
    const v = AccessTokenVerifier.getInstance(f.sdk);
    await Promise.all([v.start(), v.start()]);
    assert.equal(f.calls.get, 1);
    assert.equal(v.ready, false);
    v.stop();
    assert.equal(f.calls.unsubscribe, 1);
    await new Promise(r => setTimeout(r, 1200));
    assert.equal(f.calls.get, 1);
  });

  it('onChange fires on first load and changes only', () => {
    const v = AccessTokenVerifier.getInstance(fakeSdk().sdk);
    const seen: any[] = [];
    const off = v.onChange(st => seen.push(st));
    v.applyConfig({});
    assert.equal(seen.length, 0);
    v.applyConfig(cfg());
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0], {
      mode: 'jwt',
      strictRevocation: true,
      ready: true,
      tokenVersion: 1,
      kid: 'a',
    });
    v.applyConfig(cfg());
    assert.equal(seen.length, 1);
    v.applyConfig(cfg({ tokenVersion: 2 }));
    assert.equal(seen.length, 2);
    assert.equal(seen[1].tokenVersion, 2);
    off();
    v.applyConfig(cfg({ mode: 'session' }));
    assert.equal(seen.length, 2);
  });

  it('onChange fires after the first load via start and survives listener errors', async () => {
    const v = AccessTokenVerifier.getInstance(fakeSdk().sdk);
    let n = 0;
    v.onChange(() => {
      throw new Error('bad');
    });
    v.onChange(() => n++);
    await v.start();
    assert.equal(n, 1);
    v.stop();
  });
});
