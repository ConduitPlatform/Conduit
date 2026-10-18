import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasCompleteOAuthCredentials,
  invalidateOAuthSettingsCache,
  isGlobalOAuthAvailable,
  OAuthSettingsCache,
  oauthSettingsVersion,
  pickCallbackRedirect,
  settingsForRealm,
  stateRealmRef,
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

describe('settingsForRealm (getSettingsFor)', () => {
  type Settings = { clientId: string; builtFrom?: string };
  const globalSettings: Settings = { clientId: 'global' };
  const effective = (clientId: string, clientSecret = 's') => ({
    clientId,
    clientSecret,
  });
  const missing = () => new Error('STRATEGY_NOT_AVAILABLE_FOR_REALM');
  const build = (e: { clientId: string }): Settings => ({
    clientId: e.clientId,
    builtFrom: 'realm',
  });

  it('returns the global settings for a request without a realm', () => {
    const cache = new OAuthSettingsCache<Settings>();
    assert.equal(
      settingsForRealm({ globalSettings, realm: null, cache, build, missing }),
      globalSettings,
    );
    assert.equal(cache.size, 0);
  });

  it('fails closed for a realm without an entry for the provider', () => {
    const cache = new OAuthSettingsCache<Settings>();
    for (const eff of [undefined, null]) {
      assert.throws(
        () =>
          settingsForRealm({
            globalSettings,
            realm: { id: 'r1', effective: eff },
            cache,
            build,
            missing,
          }),
        /STRATEGY_NOT_AVAILABLE_FOR_REALM/,
      );
    }
  });

  it('builds distinct settings per realm and reuses them', () => {
    const cache = new OAuthSettingsCache<Settings>();
    let builds = 0;
    const counting = (e: { clientId: string }) => {
      builds++;
      return build(e);
    };
    const get = (id: string, clientId: string) =>
      settingsForRealm({
        globalSettings,
        realm: { id, effective: effective(clientId) },
        cache,
        build: counting,
        missing,
      });
    const a = get('r1', 'id-a');
    const b = get('r2', 'id-b');
    assert.equal(a.clientId, 'id-a');
    assert.equal(b.clientId, 'id-b');
    assert.notEqual(a, globalSettings);
    assert.equal(get('r1', 'id-a'), a);
    assert.equal(builds, 2);
  });

  it('rebuilds when the credential version changes (rotated secret or client id)', () => {
    const cache = new OAuthSettingsCache<Settings>();
    const get = (e: { clientId: string; clientSecret: string }) =>
      settingsForRealm({
        globalSettings,
        realm: { id: 'r1', effective: e },
        cache,
        build,
        missing,
      });
    const first = get(effective('id', 'old'));
    assert.equal(get(effective('id', 'old')), first);
    const rotated = get(effective('id', 'new'));
    assert.notEqual(rotated, first);
    assert.equal(get(effective('other', 'new')).clientId, 'other');
    assert.equal(cache.size, 1);
  });

  it('rebuilds after the cache is invalidated', () => {
    const cache = new OAuthSettingsCache<Settings>();
    const get = () =>
      settingsForRealm({
        globalSettings,
        realm: { id: 'r1', effective: effective('id') },
        cache,
        build,
        missing,
      });
    const first = get();
    invalidateOAuthSettingsCache();
    assert.notEqual(get(), first);
  });
});

describe('hasCompleteOAuthCredentials with a mixed pair', () => {
  it('a clientId without its own secret is incomplete', () => {
    assert.equal(
      hasCompleteOAuthCredentials('google', { clientId: 'realm-id', clientSecret: '' }),
      false,
    );
  });
});

describe('stateRealmRef', () => {
  it('prefers the realm id over the slug', () => {
    assert.deepEqual(stateRealmRef({ realmId: 'abc', realm: 'acme' }), { id: 'abc' });
    assert.deepEqual(stateRealmRef({ realmId: 42 }), { id: '42' });
  });

  it('falls back to the slug of an in-flight token', () => {
    assert.deepEqual(stateRealmRef({ realm: 'acme' }), { slug: 'acme' });
    assert.deepEqual(stateRealmRef({ realmId: '', realm: 'acme' }), { slug: 'acme' });
  });

  it('is null for a global flow', () => {
    assert.equal(stateRealmRef({}), null);
    assert.equal(stateRealmRef(undefined), null);
    assert.equal(stateRealmRef({ realm: '', realmId: null }), null);
  });
});

describe('pickCallbackRedirect', () => {
  it('uses custom redirect, then the realm one, then the global one', () => {
    assert.equal(
      pickCallbackRedirect(['https://c', 'https://r', 'https://g']),
      'https://c',
    );
    assert.equal(
      pickCallbackRedirect([undefined, 'https://r', 'https://g']),
      'https://r',
    );
    assert.equal(pickCallbackRedirect(['', '  ', 'https://g']), 'https://g');
    assert.equal(pickCallbackRedirect([undefined, null, '']), undefined);
  });
});
