import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { strategyEnabledQuery } from './strategyRealms.logic.js';

describe('strategyEnabledQuery', () => {
  it('queries plain strategies', () => {
    assert.deepEqual(strategyEnabledQuery('local'), {
      active: true,
      'strategies.local.enabled': true,
    });
    assert.deepEqual(strategyEnabledQuery('magicLink'), {
      active: true,
      'strategies.magicLink.enabled': true,
    });
  });

  it('queries oauth providers', () => {
    assert.deepEqual(strategyEnabledQuery('oauth.google'), {
      active: true,
      'strategies.oauth.google.enabled': true,
    });
  });

  it('rejects unknown keys', () => {
    assert.throws(() => strategyEnabledQuery('teams'));
    assert.throws(() => strategyEnabledQuery('oauth.myspace'));
    assert.throws(() => strategyEnabledQuery('oauth.'));
  });
});
