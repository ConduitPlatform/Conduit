import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getConduitCode } from '@conduitplatform/grpc-sdk';
import { errors } from '../../../errors.js';
import {
  assertFacebookTokenAudience,
  verifyGoogleIdToken,
} from './providerTokenAudience.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const other = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const getKey = async () => ({ getPublicKey: () => publicKey });

function googleToken(
  claims: Record<string, unknown> = {},
  key: string = privateKey,
  options: jwt.SignOptions = {},
) {
  return jwt.sign(
    {
      iss: 'https://accounts.google.com',
      aud: 'client-a',
      sub: 'google-user',
      email: 'user@example.com',
      email_verified: true,
      ...claims,
    },
    key,
    {
      algorithm: 'RS256',
      keyid: 'k1',
      ...(claims.exp ? {} : { expiresIn: 3600 }),
      ...options,
    },
  );
}

const authFailed = (err: unknown) =>
  getConduitCode(err) === errors.OAUTH_PROVIDER_AUTH_FAILED.conduitCode;

describe('verifyGoogleIdToken', () => {
  it('accepts a token issued for the configured client', async () => {
    const claims = await verifyGoogleIdToken(googleToken(), 'client-a', getKey);
    assert.equal(claims.sub, 'google-user');
  });

  it('accepts the bare accounts.google.com issuer', async () => {
    const token = googleToken({ iss: 'accounts.google.com' });
    const claims = await verifyGoogleIdToken(token, 'client-a', getKey);
    assert.equal(claims.sub, 'google-user');
  });

  it('rejects a token issued for another client', async () => {
    await assert.rejects(
      verifyGoogleIdToken(googleToken({ aud: 'client-b' }), 'client-a', getKey),
      authFailed,
    );
  });

  it('rejects an unexpected issuer', async () => {
    await assert.rejects(
      verifyGoogleIdToken(
        googleToken({ iss: 'https://example.com' }),
        'client-a',
        getKey,
      ),
      authFailed,
    );
  });

  it('rejects an expired token', async () => {
    const token = googleToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    await assert.rejects(verifyGoogleIdToken(token, 'client-a', getKey), authFailed);
  });

  it('rejects a token signed with a different key', async () => {
    await assert.rejects(
      verifyGoogleIdToken(googleToken({}, other.privateKey), 'client-a', getKey),
      authFailed,
    );
  });

  it('rejects a missing id_token or empty client id', async () => {
    await assert.rejects(verifyGoogleIdToken(undefined, 'client-a', getKey), authFailed);
    await assert.rejects(verifyGoogleIdToken(googleToken(), '', getKey), authFailed);
  });

  it('maps a JWKS fetch failure to a provider request error', async () => {
    await assert.rejects(
      verifyGoogleIdToken(googleToken(), 'client-a', async () => {
        throw new Error('network down');
      }),
      (err: unknown) =>
        getConduitCode(err) === errors.OAUTH_PROVIDER_REQUEST_FAILED.conduitCode,
    );
  });
});

describe('assertFacebookTokenAudience', () => {
  afterEach(() => mock.restoreAll());

  function mockDebugToken(data: unknown) {
    return mock.method(axios, 'get', async () => ({ data: { data } }));
  }

  it('accepts a valid token issued for the configured app', async () => {
    const get = mockDebugToken({ is_valid: true, app_id: 'app-1' });
    await assertFacebookTokenAudience('user-token', 'app-1', 'secret');
    const [url, config] = get.mock.calls[0].arguments as unknown as [
      string,
      { params: Record<string, string> },
    ];
    assert.equal(url, 'https://graph.facebook.com/debug_token');
    assert.equal(config.params.input_token, 'user-token');
    assert.equal(config.params.access_token, 'app-1|secret');
  });

  it('rejects a token issued for another app', async () => {
    mockDebugToken({ is_valid: true, app_id: 'app-2' });
    await assert.rejects(
      assertFacebookTokenAudience('user-token', 'app-1', 'secret'),
      authFailed,
    );
  });

  it('rejects an invalid token', async () => {
    mockDebugToken({ is_valid: false, app_id: 'app-1' });
    await assert.rejects(
      assertFacebookTokenAudience('user-token', 'app-1', 'secret'),
      authFailed,
    );
  });

  it('rejects when the debug response carries no data', async () => {
    mockDebugToken(undefined);
    await assert.rejects(
      assertFacebookTokenAudience('user-token', 'app-1', 'secret'),
      authFailed,
    );
  });

  it('maps a request failure to a provider request error', async () => {
    mock.method(axios, 'get', async () => {
      throw new Error('boom');
    });
    await assert.rejects(
      assertFacebookTokenAudience('user-token', 'app-1', 'secret'),
      (err: unknown) =>
        getConduitCode(err) === errors.OAUTH_PROVIDER_REQUEST_FAILED.conduitCode,
    );
  });
});
