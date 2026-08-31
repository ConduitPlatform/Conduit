import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppleOAuthClient } from './resolveAppleOAuthClient.js';
import { ConfigController } from '@conduitplatform/module-tools';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

describe('resolveAppleOAuthClient', () => {
  beforeEach(() => {
    ConfigController.getInstance().config = {
      apple: {
        clientId: 'default-client-id',
        privateKey: 'default-private-key',
        teamId: 'default-team-id',
        keyId: 'default-key-id',
        redirect_uri: 'https://example.com/callback',
        clients: [],
      },
    };
  });

  it('returns top-level credentials when oauthClientId is not provided', () => {
    const result = resolveAppleOAuthClient();
    assert.deepEqual(result, {
      clientId: 'default-client-id',
      privateKey: 'default-private-key',
      teamId: 'default-team-id',
      keyId: 'default-key-id',
      redirect_uri: 'https://example.com/callback',
    });
  });

  it('inherits credentials when client has only id and clientId', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-1',
        clientId: 'app-specific-client-id',
        privateKey: '',
        teamId: '',
        keyId: '',
      },
    ];

    const result = resolveAppleOAuthClient('client-1');
    assert.deepEqual(result, {
      clientId: 'app-specific-client-id',
      privateKey: 'default-private-key',
      teamId: 'default-team-id',
      keyId: 'default-key-id',
      redirect_uri: 'https://example.com/callback',
    });
  });

  it('uses client credentials when all four are set', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-2',
        clientId: 'second-team-client-id',
        privateKey: 'second-team-private-key',
        teamId: 'second-team-id',
        keyId: 'second-team-key-id',
      },
    ];

    const result = resolveAppleOAuthClient('client-2');
    assert.deepEqual(result, {
      clientId: 'second-team-client-id',
      privateKey: 'second-team-private-key',
      teamId: 'second-team-id',
      keyId: 'second-team-key-id',
      redirect_uri: 'https://example.com/callback',
    });
  });

  it('throws INVALID_ARGUMENT for mixed credentials (only privateKey set)', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-3',
        clientId: 'mixed-client-id',
        privateKey: 'some-private-key',
        teamId: '',
        keyId: '',
      },
    ];

    assert.throws(
      () => resolveAppleOAuthClient('client-3'),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('mixed credentials'),
    );
  });

  it('throws INVALID_ARGUMENT for mixed credentials (only teamId and keyId set)', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-4',
        clientId: 'mixed-client-id',
        privateKey: '',
        teamId: 'some-team-id',
        keyId: 'some-key-id',
      },
    ];

    assert.throws(
      () => resolveAppleOAuthClient('client-4'),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('mixed credentials'),
    );
  });

  it('throws INVALID_ARGUMENT for unknown client id', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-1',
        clientId: 'some-client-id',
      },
    ];

    assert.throws(
      () => resolveAppleOAuthClient('unknown-client'),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('Unknown Apple OAuth client id'),
    );
  });

  it('throws INVALID_ARGUMENT for missing clientId', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-5',
        clientId: '',
      },
    ];

    assert.throws(
      () => resolveAppleOAuthClient('client-5'),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('missing clientId'),
    );
  });

  it('throws INVALID_ARGUMENT for empty id', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: '',
        clientId: 'some-client-id',
      },
    ];

    assert.throws(
      () => resolveAppleOAuthClient(''),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('id cannot be empty'),
    );
  });

  it('uses client-specific redirect_uri when provided', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-6',
        clientId: 'client-with-redirect',
        redirect_uri: 'https://custom.com/callback',
        privateKey: '',
        teamId: '',
        keyId: '',
      },
    ];

    const result = resolveAppleOAuthClient('client-6');
    assert.strictEqual(result.redirect_uri, 'https://custom.com/callback');
  });

  it('falls back to default redirect_uri when client redirect_uri is omitted', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-7',
        clientId: 'client-without-redirect',
        privateKey: '',
        teamId: '',
        keyId: '',
      },
    ];

    const result = resolveAppleOAuthClient('client-7');
    assert.strictEqual(result.redirect_uri, 'https://example.com/callback');
  });

  it('inherits when credentials are undefined (not just empty string)', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-8',
        clientId: 'inherit-undefined',
      },
    ];

    const result = resolveAppleOAuthClient('client-8');
    assert.deepEqual(result, {
      clientId: 'inherit-undefined',
      privateKey: 'default-private-key',
      teamId: 'default-team-id',
      keyId: 'default-key-id',
      redirect_uri: 'https://example.com/callback',
    });
  });

  it('treats empty string as omit for inheritance', () => {
    ConfigController.getInstance().config.apple.clients = [
      {
        id: 'client-9',
        clientId: 'empty-string-inherit',
        privateKey: '',
        teamId: '',
        keyId: '',
      },
    ];

    const result = resolveAppleOAuthClient('client-9');
    assert.strictEqual(result.privateKey, 'default-private-key');
    assert.strictEqual(result.teamId, 'default-team-id');
    assert.strictEqual(result.keyId, 'default-key-id');
  });
});
