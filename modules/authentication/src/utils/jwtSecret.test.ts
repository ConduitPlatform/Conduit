import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureAccessTokenJwtSecret } from './jwtSecret.js';

describe('ensureAccessTokenJwtSecret', () => {
  it('generates a non-empty secret when empty', () => {
    const config = { accessTokens: { jwtSecret: '' } };
    ensureAccessTokenJwtSecret(config);
    assert.ok(config.accessTokens.jwtSecret.length > 0);
  });

  it('leaves S3CR3T unchanged', () => {
    const config = { accessTokens: { jwtSecret: 'S3CR3T' } };
    ensureAccessTokenJwtSecret(config);
    assert.equal(config.accessTokens.jwtSecret, 'S3CR3T');
  });

  it('leaves a custom secret unchanged', () => {
    const config = { accessTokens: { jwtSecret: 'my-custom-secret' } };
    ensureAccessTokenJwtSecret(config);
    assert.equal(config.accessTokens.jwtSecret, 'my-custom-secret');
  });

  it('treats whitespace as empty and generates a secret', () => {
    const config = { accessTokens: { jwtSecret: '   ' } };
    ensureAccessTokenJwtSecret(config);
    assert.ok(config.accessTokens.jwtSecret.length > 0);
    assert.notEqual(config.accessTokens.jwtSecret.trim(), '');
  });
});
