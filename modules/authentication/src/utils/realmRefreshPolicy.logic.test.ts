import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEffectiveSettings,
  defaultRealmSettings,
  effectiveRefreshPolicy,
  refreshPolicyOf,
} from './realm.logic.js';
import { buildRealmSettingsWrite } from '../admin/realm.logic.js';
import { exportRealmSettings } from './realmExport.logic.js';

const global = { expiryPeriod: 1000, extendable: true, maxLifetime: 5000 };

describe('effectiveRefreshPolicy', () => {
  it('inherits global for null leaves', () => {
    assert.deepEqual(
      effectiveRefreshPolicy(global, {
        expiryPeriod: null,
        extendable: null,
        maxLifetime: null,
      }),
      global,
    );
    assert.deepEqual(effectiveRefreshPolicy(global, null), global);
  });
  it('only tightens', () => {
    assert.deepEqual(
      effectiveRefreshPolicy(global, {
        expiryPeriod: 500,
        extendable: false,
        maxLifetime: 2000,
      }),
      { expiryPeriod: 500, extendable: false, maxLifetime: 2000 },
    );
    assert.deepEqual(
      effectiveRefreshPolicy(global, {
        expiryPeriod: 9000,
        extendable: true,
        maxLifetime: 9000,
      }),
      global,
    );
  });
  it('a realm cannot enable extension the global config forbids', () => {
    assert.equal(
      effectiveRefreshPolicy({ ...global, extendable: false }, { extendable: true })
        .extendable,
      false,
    );
  });
});

describe('realm session policy settings', () => {
  it('defaults carry nulls and flow into effective settings', () => {
    assert.deepEqual(defaultRealmSettings().policies.session.refreshTokens, {
      expiryPeriod: null,
      extendable: null,
      maxLifetime: null,
    });
    const eff = buildEffectiveSettings(
      { refreshTokens: { expiryPeriod: 1000, extendable: true, maxLifetime: 5000 } },
      defaultRealmSettings(),
    );
    assert.deepEqual(eff.policies.session.refreshTokens, global);
  });
  it('refreshPolicyOf drops malformed leaves', () => {
    assert.deepEqual(
      refreshPolicyOf({ expiryPeriod: -1, extendable: 'x', maxLifetime: 5 }),
      {
        expiryPeriod: null,
        extendable: null,
        maxLifetime: 5,
      },
    );
  });
  it('PATCH validation', () => {
    const write = (refreshTokens: object, base = defaultRealmSettings()) =>
      buildRealmSettingsWrite({
        base: base as any,
        input: { policies: { session: { refreshTokens } } },
      });
    assert.throws(() => write({ expiryPeriod: 0 }));
    assert.throws(() => write({ expiryPeriod: 'x' }));
    assert.throws(() => write({ extendable: 'yes' }));
    assert.throws(() => write({ expiryPeriod: 10, maxLifetime: 5 }));
    // a patch setting only one leaf is checked against the stored other one
    const stored = write({ expiryPeriod: 100, maxLifetime: 200 }).settings;
    assert.throws(() => write({ maxLifetime: 50 }, stored as any));
    const ok = write({ maxLifetime: 300, extendable: false }, stored as any).settings;
    assert.deepEqual(ok.policies.session.refreshTokens, {
      expiryPeriod: 100,
      extendable: false,
      maxLifetime: 300,
    });
    const cleared = write({ expiryPeriod: null }, stored as any).settings;
    assert.equal(cleared.policies.session.refreshTokens.expiryPeriod, null);
  });
  it('export preserves nulls', () => {
    const exported = exportRealmSettings(defaultRealmSettings(), new Map());
    assert.deepEqual((exported.policies as any).session.refreshTokens, {
      expiryPeriod: null,
      extendable: null,
      maxLifetime: null,
    });
  });
});
