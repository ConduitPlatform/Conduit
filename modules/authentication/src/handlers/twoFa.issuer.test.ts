import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk, DatabaseProvider, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { TwoFa } from './twoFa.js';
import { TwoFactorSecret, User } from '../models/index.js';

type Doc = Record<string, any>;

const secrets: Doc[] = [];
const userUpdates: Doc[] = [];
const database = {
  async deleteMany(name: string, query: Doc) {
    if (name === 'TwoFactorSecret') {
      const kept = secrets.filter(doc => doc.user !== query.user);
      secrets.splice(0, secrets.length, ...kept);
    }
    return { deletedCount: 0 };
  },
  async create(name: string, doc: Doc) {
    if (name === 'TwoFactorSecret') secrets.push(doc);
    return { _id: 'secret-1', ...doc };
  },
  async findByIdAndUpdate(name: string, id: string, doc: Doc) {
    userUpdates.push({ name, id, ...doc });
    return { _id: id, ...doc };
  },
} as unknown as DatabaseProvider;
TwoFactorSecret.getInstance(database);
User.getInstance(database);

function enable(issuer?: string) {
  const handlers = new TwoFa({} as ConduitGrpcSdk);
  return handlers.enableTwoFa({
    request: {
      params: { method: 'authenticator', ...(issuer !== undefined ? { issuer } : {}) },
      context: {
        jwtPayload: { sudo: true },
        user: { _id: 'user-1', email: 'user@example.com', hasTwoFA: false },
      },
    },
  } as any);
}

function issuerOf(uri: string) {
  return decodeURIComponent(new URL(uri).searchParams.get('issuer')!);
}

describe('TwoFa.enableTwoFa issuer', () => {
  beforeEach(() => {
    secrets.length = 0;
    userUpdates.length = 0;
    ConfigController.getInstance().config = {
      twoFa: {
        enabled: true,
        methods: { sms: false, authenticator: true },
        issuer: 'Acme',
        allowedIssuers: ['Acme Mobile', 'Ελλάδα 😀'],
      },
    };
  });

  it('uses the configured issuer when the body has none', async () => {
    await enable();
    assert.equal(secrets.length, 1);
    assert.equal(issuerOf(secrets[0].uri), 'Acme');
    assert.ok(secrets[0].uri.startsWith('otpauth://totp/Acme%3A'));
  });

  it('passes an allowlisted issuer from the body into the otpauth URI', async () => {
    await enable('Ελλάδα 😀');
    assert.equal(issuerOf(secrets[0].uri), 'Ελλάδα 😀');
    assert.ok(
      secrets[0].uri.startsWith(`otpauth://totp/${encodeURIComponent('Ελλάδα 😀')}%3A`),
    );
    assert.deepEqual(userUpdates, [
      { name: 'User', id: 'user-1', twoFaMethod: 'authenticator' },
    ]);
  });

  it('rejects an issuer that is not allowlisted without storing a secret', async () => {
    await assert.rejects(
      () => enable('Evil Corp'),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.equal(secrets.length, 0);
    assert.equal(userUpdates.length, 0);
  });
});
