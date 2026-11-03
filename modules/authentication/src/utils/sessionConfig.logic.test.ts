import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSessionConfigView,
  applyServerManagedSessionFields,
  clampRefreshMaxLifetime,
  sessionModeConfigError,
  prepareSessionConfigUpdate,
} from './sessionConfig.logic.js';
import { emptySigning, ensureSigning, isSigningEmpty } from './signingKeys.logic.js';

describe('sessionModeConfigError', () => {
  it('accepts session mode with any access expiry', () => {
    assert.equal(
      sessionModeConfigError({
        accessTokens: { mode: 'session', expiryPeriod: 3_600_000 },
        refreshTokens: { expiryPeriod: 1000, maxLifetime: 2000 },
      }),
      null,
    );
  });
  it('rejects unknown modes', () => {
    assert.match(sessionModeConfigError({ accessTokens: { mode: 'x' } })!, /mode/);
  });
  it('bounds the access expiry in jwt mode', () => {
    for (const expiryPeriod of [59_999, 300_001, 'x']) {
      assert.match(
        sessionModeConfigError({ accessTokens: { mode: 'jwt', expiryPeriod } })!,
        /expiryPeriod/,
      );
    }
    for (const expiryPeriod of [60_000, 300_000]) {
      assert.equal(
        sessionModeConfigError({ accessTokens: { mode: 'jwt', expiryPeriod } }),
        null,
      );
    }
  });
  it('rejects only an explicitly sent maxLifetime below the expiryPeriod', () => {
    const merged = { refreshTokens: { expiryPeriod: 10, maxLifetime: 9 } };
    assert.match(
      sessionModeConfigError(merged, { refreshTokens: { maxLifetime: 9 } })!,
      /maxLifetime/,
    );
    // not sent (old install / expiryPeriod raised alone): never an error
    assert.equal(sessionModeConfigError(merged), null);
    assert.equal(
      sessionModeConfigError(merged, { refreshTokens: { expiryPeriod: 10 } }),
      null,
    );
    assert.equal(
      sessionModeConfigError(
        { refreshTokens: { expiryPeriod: 10, maxLifetime: 10 } },
        { refreshTokens: { maxLifetime: 10 } },
      ),
      null,
    );
  });
  it('skips absent values', () => {
    assert.equal(sessionModeConfigError({}), null);
    assert.equal(sessionModeConfigError(undefined), null);
  });
});

describe('mergeSessionConfigView', () => {
  it('lays a partial update over the current config', () => {
    const merged = mergeSessionConfigView(
      { accessTokens: { mode: 'session', expiryPeriod: 3_600_000 } },
      { accessTokens: { mode: 'jwt' } },
    );
    assert.match(sessionModeConfigError(merged)!, /expiryPeriod/);
  });
});

describe('clampRefreshMaxLifetime', () => {
  it('raises a maxLifetime below the expiryPeriod', () => {
    assert.deepEqual(clampRefreshMaxLifetime({ expiryPeriod: 100, maxLifetime: 50 }), {
      maxLifetime: 100,
      clamped: true,
    });
    assert.deepEqual(clampRefreshMaxLifetime({ expiryPeriod: 100, maxLifetime: 200 }), {
      maxLifetime: 200,
      clamped: false,
    });
    assert.deepEqual(clampRefreshMaxLifetime({}), {
      maxLifetime: undefined,
      clamped: false,
    });
  });
});

describe('applyServerManagedSessionFields', () => {
  const current = { mode: 'session', tokenVersion: 3 };
  it('bumps on a mode change regardless of the echoed version', () => {
    for (const echoed of [undefined, 1, 3, 3.5]) {
      const out = applyServerManagedSessionFields(current, {
        accessTokens: { mode: 'jwt', ...(echoed ? { tokenVersion: echoed } : {}) },
      });
      assert.equal(out.accessTokens?.tokenVersion, Math.max(3, echoed ?? 0) + 1);
    }
    assert.equal(
      applyServerManagedSessionFields(current, {
        accessTokens: { mode: 'jwt', tokenVersion: 10 },
      }).accessTokens?.tokenVersion,
      11,
    );
  });
  it('without a mode change drops decreases and keeps increases', () => {
    assert.equal(
      'tokenVersion' in
        applyServerManagedSessionFields(current, { accessTokens: { tokenVersion: 1 } })
          .accessTokens!,
      false,
    );
    assert.equal(
      applyServerManagedSessionFields(current, { accessTokens: { tokenVersion: 9 } })
        .accessTokens?.tokenVersion,
      9,
    );
    assert.equal(
      'tokenVersion' in
        applyServerManagedSessionFields(current, { accessTokens: { mode: 'session' } })
          .accessTokens!,
      false,
    );
  });
  it('drops incoming signing and does not mutate the input', () => {
    const input = { accessTokens: { signing: { kid: 'x' }, expiryPeriod: 1 } };
    const out = applyServerManagedSessionFields(current, input);
    assert.equal('signing' in out.accessTokens!, false);
    assert.equal(out.accessTokens?.expiryPeriod, 1);
    assert.deepEqual(input.accessTokens.signing, { kid: 'x' });
  });
  it('passes updates without accessTokens through', () => {
    const input = { active: true };
    assert.equal(applyServerManagedSessionFields(current, input), input);
  });
});

describe('prepareSessionConfigUpdate', () => {
  const current = {
    accessTokens: {
      mode: 'session',
      tokenVersion: 2,
      expiryPeriod: 3_600_000,
      signing: emptySigning(),
    },
    refreshTokens: { expiryPeriod: 100, maxLifetime: 200 },
  };
  it('a switch to jwt bumps the version and mints keys in the update', () => {
    const r = prepareSessionConfigUpdate(current as any, {
      accessTokens: { mode: 'jwt', expiryPeriod: 120_000, tokenVersion: 1 },
    });
    assert.equal(r.error, null);
    const at = r.incoming!.accessTokens as any;
    assert.equal(at.tokenVersion, 3);
    assert.equal(isSigningEmpty(at.signing), false);
  });
  it('does not mint in session mode and keeps existing keys', () => {
    const r = prepareSessionConfigUpdate(current as any, {
      accessTokens: { expiryPeriod: 5 },
    });
    assert.equal('signing' in (r.incoming!.accessTokens as any), false);
    const withKeys = {
      ...current,
      accessTokens: {
        ...current.accessTokens,
        mode: 'jwt',
        expiryPeriod: 120_000,
        signing: ensureSigning(emptySigning()),
      },
    };
    const r2 = prepareSessionConfigUpdate(withKeys as any, {
      accessTokens: { signing: { kid: 'evil' } } as any,
    });
    assert.equal('signing' in (r2.incoming!.accessTokens as any), false);
  });
  it('reports validation errors against the merged config', () => {
    const r = prepareSessionConfigUpdate(current as any, {
      accessTokens: { mode: 'jwt' },
    });
    assert.match(r.error!, /expiryPeriod/);
    const r2 = prepareSessionConfigUpdate(current as any, {
      refreshTokens: { maxLifetime: 50 },
    });
    assert.match(r2.error!, /maxLifetime/);
    const r3 = prepareSessionConfigUpdate(current as any, {
      refreshTokens: { expiryPeriod: 500 },
    });
    assert.equal(r3.error, null);
  });
});
