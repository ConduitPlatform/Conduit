import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adoptPersistedJwtSecret, ensureAccessTokenJwtSecret } from './jwtSecret.js';

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

describe('adoptPersistedJwtSecret', () => {
  it('adopts a persisted non-empty secret and does not persist again', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = adoptPersistedJwtSecret(config, 'S3CR3T');
    assert.equal(config.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(result.shouldPersist, false);
  });

  it('adopts a persisted custom secret over a locally generated one', () => {
    const config = { accessTokens: { jwtSecret: 'replica-a-secret' } };
    const result = adoptPersistedJwtSecret(config, 'replica-b-won');
    assert.equal(config.accessTokens.jwtSecret, 'replica-b-won');
    assert.equal(result.shouldPersist, false);
  });

  it('keeps a local secret and asks to persist when persisted is empty', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = adoptPersistedJwtSecret(config, '');
    assert.equal(config.accessTokens.jwtSecret, 'local-generated');
    assert.equal(result.shouldPersist, true);
  });

  it('generates and asks to persist when both persisted and local are empty', () => {
    const config = { accessTokens: { jwtSecret: '' } };
    const result = adoptPersistedJwtSecret(config, '   ');
    assert.ok(config.accessTokens.jwtSecret.length > 0);
    assert.equal(result.shouldPersist, true);
  });
});
