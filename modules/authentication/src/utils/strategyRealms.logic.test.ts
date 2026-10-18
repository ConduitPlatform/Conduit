import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REALM_OAUTH_PROVIDERS } from './realm.logic.js';
import { oauthStrategyKey, strategyEnabledQuery } from './strategyRealms.logic.js';

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

describe('oauthStrategyKey', () => {
  it('maps every oauth2 handler export to a realm provider', () => {
    // the exports of handlers/oauth2/index.ts
    const handlers = [
      'FacebookHandlers',
      'FigmaHandlers',
      'GithubHandlers',
      'GoogleHandlers',
      'MicrosoftHandlers',
      'SlackHandlers',
      'TwitchHandlers',
      'GitlabHandlers',
      'AppleHandlers',
      'TwitterHandlers',
      'RedditHandlers',
      'BitbucketHandlers',
      'LinkedInHandlers',
    ];
    const keys = handlers.map(oauthStrategyKey).map(key => key.slice('oauth.'.length));
    assert.deepEqual([...keys].sort(), [...REALM_OAUTH_PROVIDERS].sort());
    for (const handler of handlers) {
      assert.doesNotThrow(() => strategyEnabledQuery(oauthStrategyKey(handler)));
    }
  });
});
