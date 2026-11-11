import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { createSigner } from 'fast-jwt';
import { verifyAccessToken, selectVerificationKey } from '../../dist/index.esm.js';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

const NOW = 1_800_000_000_000;
const nowSec = NOW / 1000;
const current = keypair();
const previous = keypair();
const other = keypair();

function sign(key: string, kid: string, over: Record<string, unknown> = {}) {
  return createSigner({ algorithm: 'EdDSA', key, kid })({
    sub: 'u1',
    sid: 's1',
    cid: 'client-a',
    authorized: true,
    sudo: false,
    tv: 3,
    iat: nowSec - 10,
    exp: nowSec + 600,
    iss: 'conduit',
    ...over,
  });
}

const state = (retiredAt = 0) => ({
  tokenVersion: 3,
  signing: {
    kid: 'k2',
    publicKey: current.publicKey,
    previousKid: 'k1',
    previousPublicKey: previous.publicKey,
    previousRetiredAt: retiredAt,
  },
});

function reason(fn: () => unknown): string {
  try {
    fn();
  } catch (e: any) {
    assert.equal(e.code, 16);
    return e.debugLogInfo;
  }
  assert.fail('expected throw');
}

describe('verifyAccessToken', () => {
  it('accepts a valid token', () => {
    const c = verifyAccessToken(sign(current.privateKey, 'k2'), state(), { now: NOW });
    assert.equal(c.sub, 'u1');
    assert.equal(c.cid, 'client-a');
  });
  it('rejects expired tokens beyond leeway, accepts within', () => {
    const t = sign(current.privateKey, 'k2', { exp: nowSec - 3 });
    assert.doesNotThrow(() => verifyAccessToken(t, state(), { now: NOW }));
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW, leewaySeconds: 1 })),
      'expired',
    );
    const t2 = sign(current.privateKey, 'k2', { exp: nowSec - 6 });
    assert.equal(
      reason(() => verifyAccessToken(t2, state(), { now: NOW })),
      'expired',
    );
  });
  it('rejects a bad signature', () => {
    const t = sign(other.privateKey, 'k2');
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW })),
      'bad signature',
    );
  });
  it('rejects tampered payload', () => {
    const [h, , s] = sign(current.privateKey, 'k2').split('.');
    const p = Buffer.from(
      JSON.stringify({ sub: 'admin', tv: 3, exp: nowSec + 99 }),
    ).toString('base64url');
    assert.equal(
      reason(() => verifyAccessToken(`${h}.${p}.${s}`, state(), { now: NOW })),
      'bad signature',
    );
  });
  it('rejects unknown kid', () => {
    assert.equal(
      reason(() =>
        verifyAccessToken(sign(current.privateKey, 'zz'), state(), { now: NOW }),
      ),
      'unknown kid',
    );
  });
  it('rejects tokens without kid', () => {
    const t = createSigner({ algorithm: 'EdDSA', key: current.privateKey })({
      sub: 'u',
      sid: 's',
      tv: 3,
      exp: nowSec + 60,
    });
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW })),
      'unknown kid',
    );
  });
  it('rejects non-EdDSA and garbage', () => {
    const hs = createSigner({ algorithm: 'HS256', key: 'secret', kid: 'k2' })({
      sub: 'u',
    });
    assert.equal(
      reason(() => verifyAccessToken(hs, state(), { now: NOW })),
      'unsupported algorithm',
    );
    assert.equal(
      reason(() => verifyAccessToken('nope', state(), { now: NOW })),
      'malformed token',
    );
    assert.equal(
      reason(() => verifyAccessToken('', state(), { now: NOW })),
      'malformed token',
    );
  });
  it('rejects alg none', () => {
    const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const t = `${b({ alg: 'none', kid: 'k2' })}.${b({ sub: 'u', sid: 's', tv: 3, exp: nowSec + 60 })}.`;
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW })),
      'unsupported algorithm',
    );
  });
  it('rejects HS256 signed with the public PEM as secret', () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const body = `${enc({ alg: 'HS256', typ: 'JWT', kid: 'k2' })}.${enc({ sub: 'u', sid: 's', tv: 3, exp: nowSec + 60 })}`;
    const sig = createHmac('sha256', current.publicKey).update(body).digest('base64url');
    const t = `${body}.${sig}`;
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW })),
      'unsupported algorithm',
    );
  });
  it('rejects missing exp, sub or sid', () => {
    for (const k of ['exp', 'sub', 'sid']) {
      const t = sign(current.privateKey, 'k2', { [k]: undefined });
      assert.equal(
        reason(() => verifyAccessToken(t, state(), { now: NOW })),
        'malformed token',
        k,
      );
    }
  });
  it('rejects version mismatch', () => {
    const t = sign(current.privateKey, 'k2', { tv: 2 });
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW })),
      'version mismatch',
    );
  });
  it('checks client id only when given', () => {
    const t = sign(current.privateKey, 'k2');
    assert.doesNotThrow(() =>
      verifyAccessToken(t, state(), { now: NOW, clientId: 'client-a' }),
    );
    assert.equal(
      reason(() => verifyAccessToken(t, state(), { now: NOW, clientId: 'client-b' })),
      'client mismatch',
    );
    assert.equal(
      reason(() =>
        verifyAccessToken(t, state(), { now: NOW, clientId: 'anonymous-client' }),
      ),
      'client mismatch',
    );
  });
  it('honours the previous-key window', () => {
    const t = sign(previous.privateKey, 'k1');
    assert.doesNotThrow(() => verifyAccessToken(t, state(NOW + 1000), { now: NOW }));
    assert.equal(
      reason(() => verifyAccessToken(t, state(NOW), { now: NOW })),
      'unknown kid',
    );
    assert.equal(
      reason(() => verifyAccessToken(t, state(NOW - 1), { now: NOW })),
      'unknown kid',
    );
    assert.equal(
      reason(() => verifyAccessToken(t, state(0), { now: NOW })),
      'unknown kid',
    );
  });
  it('does not leak key material in errors', () => {
    const msg = reason(() =>
      verifyAccessToken(sign(other.privateKey, 'k2'), state(), { now: NOW }),
    );
    assert.ok(!msg.includes('BEGIN'));
  });
  it('selectVerificationKey picks by kid', () => {
    assert.equal(selectVerificationKey('k2', state().signing, NOW), current.publicKey);
    assert.equal(selectVerificationKey(undefined, state().signing, NOW), undefined);
  });
});
