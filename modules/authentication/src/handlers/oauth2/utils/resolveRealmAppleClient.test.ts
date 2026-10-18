import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRealmAppleClient } from './resolveRealmAppleClient.js';

const globalClient = {
  clientId: 'global.client',
  redirect_uri: 'https://global/cb',
  privateKey: 'global-key',
  teamId: 'GTEAM',
  keyId: 'GKEY',
};

const effectiveOwn = {
  clientId: 'realm.client',
  redirect_uri: 'https://realm/cb',
  privateKey: 'realm-key',
  teamId: 'RTEAM',
  keyId: 'RKEY',
};

describe('resolveRealmAppleClient', () => {
  it('uses the realm credentials when the realm has its own client id', () => {
    let globalCalls = 0;
    const client = resolveRealmAppleClient({
      realmClientId: 'realm.client',
      realmRedirectUri: 'https://realm/cb',
      effective: effectiveOwn,
      resolveGlobal: () => {
        globalCalls++;
        return globalClient;
      },
    });
    assert.deepEqual(client, effectiveOwn);
    assert.equal(globalCalls, 0);
  });

  it('inherits the global key triple and redirect when the realm only sets a client id', () => {
    const client = resolveRealmAppleClient({
      realmClientId: 'realm.client',
      realmRedirectUri: null,
      effective: {
        clientId: 'realm.client',
        redirect_uri: globalClient.redirect_uri,
        privateKey: globalClient.privateKey,
        teamId: globalClient.teamId,
        keyId: globalClient.keyId,
      },
      resolveGlobal: () => globalClient,
    });
    assert.deepEqual(client, { ...globalClient, clientId: 'realm.client' });
  });

  it('fails when the realm client id has no usable key triple', () => {
    assert.throws(
      () =>
        resolveRealmAppleClient({
          realmClientId: 'realm.client',
          effective: { ...effectiveOwn, privateKey: '', teamId: '', keyId: '' },
          resolveGlobal: () => globalClient,
        }),
      /STRATEGY_NOT_AVAILABLE_FOR_REALM/,
    );
  });

  it('falls back to the global resolution without a realm client id', () => {
    for (const realmClientId of [undefined, null, '', '  ']) {
      assert.deepEqual(
        resolveRealmAppleClient({
          realmClientId,
          effective: effectiveOwn,
          resolveGlobal: () => globalClient,
        }),
        globalClient,
      );
    }
  });

  it('lets the realm redirect_uri win over the global resolution', () => {
    assert.deepEqual(
      resolveRealmAppleClient({
        realmClientId: undefined,
        realmRedirectUri: 'https://realm/cb',
        effective: effectiveOwn,
        resolveGlobal: () => globalClient,
      }),
      { ...globalClient, redirect_uri: 'https://realm/cb' },
    );
  });

  it('propagates a global resolution failure (unknown oauthClientId)', () => {
    assert.throws(
      () =>
        resolveRealmAppleClient({
          realmClientId: undefined,
          effective: effectiveOwn,
          resolveGlobal: () => {
            throw new Error('Unknown Apple OAuth client id');
          },
        }),
      /Unknown Apple OAuth client id/,
    );
  });
});
