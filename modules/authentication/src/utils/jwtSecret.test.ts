import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adoptPersistedJwtSecret,
  decideSharedJwtSecret,
  ensureAccessTokenJwtSecret,
  isConfigMissingError,
} from './jwtSecret.js';

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

  it('leaves local empty and asks to persist when both persisted and local are empty', () => {
    const config = { accessTokens: { jwtSecret: '' } };
    const result = adoptPersistedJwtSecret(config, '   ');
    assert.equal(config.accessTokens.jwtSecret, '');
    assert.equal(result.shouldPersist, true);
  });
});

describe('decideSharedJwtSecret', () => {
  it('does not persist when the persisted read failed', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(config, { ok: false });
    assert.equal(config.accessTokens.jwtSecret, 'local-generated');
    assert.equal(result.shouldPersist, false);
  });

  it('adopts persisted S3CR3T after a successful read', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(config, {
      ok: true,
      config: { accessTokens: { jwtSecret: 'S3CR3T' } },
    });
    assert.equal(config.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(result.shouldPersist, false);
  });

  it('asks to persist when a successful read shows an empty secret', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(config, { ok: true, config: null });
    assert.equal(config.accessTokens.jwtSecret, 'local-generated');
    assert.equal(result.shouldPersist, true);
  });

  it('startup adopts persisted S3CR3T over a local mint', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(
      config,
      { ok: true, config: { accessTokens: { jwtSecret: 'S3CR3T' } } },
      'startup',
    );
    assert.equal(config.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(result.shouldPersist, false);
  });

  it('update keeps a local mint when persist is still S3CR3T', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(
      config,
      { ok: true, config: { accessTokens: { jwtSecret: 'S3CR3T' } } },
      'update',
    );
    assert.equal(config.accessTokens.jwtSecret, 'local-generated');
    assert.equal(result.shouldPersist, false);
  });

  it('update keeps an explicit local secret over a persisted custom secret', () => {
    const config = { accessTokens: { jwtSecret: 'admin-set-secret' } };
    const result = decideSharedJwtSecret(
      config,
      { ok: true, config: { accessTokens: { jwtSecret: 'old-custom' } } },
      'update',
    );
    assert.equal(config.accessTokens.jwtSecret, 'admin-set-secret');
    assert.equal(result.shouldPersist, false);
  });

  it('update adopts persist when the local secret is empty', () => {
    const config = { accessTokens: { jwtSecret: '' } };
    const result = decideSharedJwtSecret(
      config,
      { ok: true, config: { accessTokens: { jwtSecret: 'custom-secret' } } },
      'update',
    );
    assert.equal(config.accessTokens.jwtSecret, 'custom-secret');
    assert.equal(result.shouldPersist, false);
  });

  it('does not persist a failed read in update mode', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(config, { ok: false }, 'update');
    assert.equal(config.accessTokens.jwtSecret, 'local-generated');
    assert.equal(result.shouldPersist, false);
  });

  it('startup asks to persist when persist is empty and local is minted', () => {
    const config = { accessTokens: { jwtSecret: 'local-generated' } };
    const result = decideSharedJwtSecret(config, { ok: true, config: null }, 'startup');
    assert.equal(config.accessTokens.jwtSecret, 'local-generated');
    assert.equal(result.shouldPersist, true);
  });
});

describe('isConfigMissingError', () => {
  it('treats the core missing-config message as empty, not failed', () => {
    assert.equal(
      isConfigMissingError(new Error('13 INTERNAL: Config for module not set!')),
      true,
    );
  });

  it('does not treat a timeout as missing config', () => {
    assert.equal(
      isConfigMissingError(new Error('14 UNAVAILABLE: deadline exceeded')),
      false,
    );
  });
});
