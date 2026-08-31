import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAppleClients } from './validateAppleClients.js';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

describe('validateAppleClients', () => {
  it('accepts valid clients with inherited credentials', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: 'app1-client-id',
        privateKey: '',
        teamId: '',
        keyId: '',
      },
    ];
    assert.doesNotThrow(() => validateAppleClients(clients));
  });

  it('accepts valid clients with full credentials', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: 'app1-client-id',
        privateKey: 'full-key',
        teamId: 'full-team',
        keyId: 'full-keyid',
      },
    ];
    assert.doesNotThrow(() => validateAppleClients(clients));
  });

  it('rejects client with empty id on config save', () => {
    const clients = [
      {
        id: '',
        clientId: 'some-client-id',
      },
    ];
    assert.throws(
      () => validateAppleClients(clients),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('id cannot be empty'),
    );
  });

  it('rejects client with whitespace-only id', () => {
    const clients = [
      {
        id: '   ',
        clientId: 'some-client-id',
      },
    ];
    assert.throws(
      () => validateAppleClients(clients),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('id cannot be empty'),
    );
  });

  it('rejects duplicate client ids', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: 'app1-client-id',
      },
      {
        id: 'client-1',
        clientId: 'app2-client-id',
      },
    ];
    assert.throws(
      () => validateAppleClients(clients),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('Duplicate Apple OAuth client id: client-1'),
    );
  });

  it('rejects client missing clientId', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: '',
      },
    ];
    assert.throws(
      () => validateAppleClients(clients),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes("missing clientId"),
    );
  });

  it('rejects mixed credentials (only privateKey set)', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: 'app1-client-id',
        privateKey: 'some-key',
        teamId: '',
        keyId: '',
      },
    ];
    assert.throws(
      () => validateAppleClients(clients),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('mixed credentials'),
    );
  });

  it('rejects mixed credentials (only teamId and keyId set)', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: 'app1-client-id',
        privateKey: '',
        teamId: 'some-team',
        keyId: 'some-keyid',
      },
    ];
    assert.throws(
      () => validateAppleClients(clients),
      (err: any) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('mixed credentials'),
    );
  });

  it('accepts multiple valid clients', () => {
    const clients = [
      {
        id: 'client-1',
        clientId: 'app1-client-id',
        privateKey: '',
        teamId: '',
        keyId: '',
      },
      {
        id: 'client-2',
        clientId: 'app2-client-id',
        privateKey: 'full-key',
        teamId: 'full-team',
        keyId: 'full-keyid',
      },
    ];
    assert.doesNotThrow(() => validateAppleClients(clients));
  });
});
