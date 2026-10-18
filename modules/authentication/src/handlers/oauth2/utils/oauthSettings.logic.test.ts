import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasCompleteOAuthCredentials,
  invalidateOAuthSettingsCache,
  isGlobalOAuthAvailable,
  OAuthSettingsCache,
  oauthSettingsVersion,
} from './oauthSettings.logic.js';

describe('hasCompleteOAuthCredentials', () => {
  it('needs a client id and a client secret for regular providers', () => {
    assert.equal(
      hasCompleteOAuthCredentials('google', { clientId: 'id', clientSecret: 's' }),
      true,
    );
    assert.equal(hasCompleteOAuthCredentials('google', { clientId: 'id' }), false);
    assert.equal(
      hasCompleteOAuthCredentials('google', { clientId: '', clientSecret: 's' }),
      false,
    );
    assert.equal(
      hasCompleteOAuthCredentials('google', { clientId: 'id', clientSecret: '  ' }),
      false,
    );
    assert.equal(hasCompleteOAuthCredentials('google', null), false);
  });

  it('needs the whole key triple for apple, not a client secret', () => {
    const apple = { clientId: 'id', privateKey: 'k', teamId: 't', keyId: 'kid' };
    assert.equal(hasCompleteOAuthCredentials('apple', apple), true);
    assert.equal(hasCompleteOAuthCredentials('apple', { ...apple, keyId: '' }), false);
    assert.equal(
      hasCompleteOAuthCredentials('apple', { ...apple, privateKey: undefined }),
      false,
    );
    assert.equal(
      hasCompleteOAuthCredentials('apple', { clientId: 'id', clientSecret: 's' }),
      false,
    );
  });
});

describe('isGlobalOAuthAvailable', () => {
  it('requires enabled and complete credentials', () => {
    const cfg = { enabled: true, clientId: 'id', clientSecret: 's' };
    assert.equal(isGlobalOAuthAvailable('github', cfg), true);
    assert.equal(isGlobalOAuthAvailable('github', { ...cfg, enabled: false }), false);
    assert.equal(isGlobalOAuthAvailable('github', { ...cfg, clientSecret: '' }), false);
    assert.equal(isGlobalOAuthAvailable('github', undefined), false);
  });
});

describe('oauthSettingsVersion', () => {
  const base = { clientId: 'id', clientSecret: 's', redirect_uri: 'https://x' };

  it('is stable for equal credentials and hides the secrets', () => {
    assert.equal(oauthSettingsVersion(base), oauthSettingsVersion({ ...base }));
    assert.ok(!oauthSettingsVersion(base).includes('s'.repeat(8)));
    assert.match(oauthSettingsVersion(base), /^[0-9a-f]{64}$/);
  });

  it('changes with every credential field', () => {
    const v = oauthSettingsVersion(base);
    for (const patch of [
      { clientId: 'other' },
      { clientSecret: 'other' },
      { redirect_uri: 'https://y' },
      { accountLinking: false },
      { privateKey: 'k' },
      { teamId: 't' },
      { keyId: 'kid' },
    ]) {
      assert.notEqual(oauthSettingsVersion({ ...base, ...patch }), v);
    }
  });
});

describe('OAuthSettingsCache', () => {
  it('builds once per realm and version', () => {
    const cache = new OAuthSettingsCache<{ n: number }>();
    let builds = 0;
    const build = () => ({ n: ++builds });
    const a = cache.get('realm-a', 'v1', build);
    assert.equal(cache.get('realm-a', 'v1', build), a);
    assert.equal(builds, 1);
    cache.get('realm-b', 'v1', build);
    assert.equal(builds, 2);
  });

  it('rebuilds when the version changes and keeps one entry per realm', () => {
    const cache = new OAuthSettingsCache<{ n: number }>();
    let builds = 0;
    const build = () => ({ n: ++builds });
    cache.get('realm-a', 'v1', build);
    const next = cache.get('realm-a', 'v2', build);
    assert.equal(next.n, 2);
    assert.equal(cache.size, 1);
  });

  it('drops everything on invalidateOAuthSettingsCache', () => {
    const cache = new OAuthSettingsCache<{ n: number }>();
    const other = new OAuthSettingsCache<{ n: number }>();
    let builds = 0;
    const build = () => ({ n: ++builds });
    cache.get('realm-a', 'v1', build);
    other.get('realm-a', 'v1', build);
    invalidateOAuthSettingsCache();
    cache.get('realm-a', 'v1', build);
    other.get('realm-a', 'v1', build);
    assert.equal(builds, 4);
  });

  it('evicts the oldest realm beyond its bound', () => {
    const cache = new OAuthSettingsCache<number>(2);
    cache.get('a', 'v', () => 1);
    cache.get('b', 'v', () => 2);
    cache.get('c', 'v', () => 3);
    assert.equal(cache.size, 2);
    let rebuilt = false;
    cache.get('a', 'v', () => {
      rebuilt = true;
      return 1;
    });
    assert.equal(rebuilt, true);
  });
});
