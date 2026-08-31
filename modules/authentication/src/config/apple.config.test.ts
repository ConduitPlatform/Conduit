import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import appleConfig from './apple.config.js';

describe('Admin apple.clients[] object array persistence', () => {
  it('round-trips object array through convict load and getProperties', () => {
    const schema = convict(appleConfig);

    const testConfig = {
      apple: {
        enabled: true,
        clientId: 'default-client-id',
        clientSecret: 'default-secret',
        redirect_uri: 'https://example.com/callback',
        privateKey: 'default-private-key',
        teamId: 'default-team-id',
        keyId: 'default-key-id',
        accountLinking: false,
        clients: [
          {
            id: 'app1',
            name: 'First App',
            clientId: 'app1-client-id',
            privateKey: '',
            teamId: '',
            keyId: '',
            redirect_uri: 'https://app1.example.com/callback',
          },
          {
            id: 'app2',
            name: 'Second App',
            clientId: 'app2-client-id',
            privateKey: 'app2-private-key',
            teamId: 'app2-team-id',
            keyId: 'app2-key-id',
          },
        ],
      },
    };

    schema.load(testConfig);
    schema.validate({ allowed: 'warn' });

    const result = schema.getProperties();

    assert.ok(Array.isArray(result.apple.clients), 'clients should be an array');
    assert.strictEqual(result.apple.clients.length, 2, 'should have 2 clients');

    const client1 = result.apple.clients[0];
    assert.strictEqual(typeof client1, 'object', 'client should be an object, not string');
    assert.strictEqual(client1.id, 'app1');
    assert.strictEqual(client1.name, 'First App');
    assert.strictEqual(client1.clientId, 'app1-client-id');
    assert.strictEqual(client1.redirect_uri, 'https://app1.example.com/callback');

    const client2 = result.apple.clients[1];
    assert.strictEqual(typeof client2, 'object', 'client should be an object, not string');
    assert.strictEqual(client2.id, 'app2');
    assert.strictEqual(client2.name, 'Second App');
    assert.strictEqual(client2.clientId, 'app2-client-id');
    assert.strictEqual(client2.privateKey, 'app2-private-key');
    assert.strictEqual(client2.teamId, 'app2-team-id');
    assert.strictEqual(client2.keyId, 'app2-key-id');
  });

  it('does not stringify object array entries', () => {
    const schema = convict(appleConfig);

    const testConfig = {
      apple: {
        enabled: true,
        clientId: 'default-client-id',
        clientSecret: 'default-secret',
        redirect_uri: 'https://example.com/callback',
        privateKey: 'default-private-key',
        teamId: 'default-team-id',
        keyId: 'default-key-id',
        accountLinking: false,
        clients: [
          {
            id: 'test-app',
            clientId: 'test-client-id',
          },
        ],
      },
    };

    schema.load(testConfig);
    const result = schema.getProperties();

    const client = result.apple.clients[0];
    assert.notStrictEqual(
      typeof client,
      'string',
      'client should not be stringified to "[object Object]"',
    );
    assert.strictEqual(typeof client, 'object', 'client must remain an object');
    assert.strictEqual(client.id, 'test-app');
  });
});
