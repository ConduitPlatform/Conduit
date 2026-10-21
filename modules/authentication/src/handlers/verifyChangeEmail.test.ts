import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/TokenType.js';
import {
  commitVerifiedEmailChange,
  type ChangeEmailVerificationToken,
  type VerifyChangeEmailDb,
} from './verifyChangeEmail.js';

const TOKEN: ChangeEmailVerificationToken = {
  _id: 'token-1',
  data: { email: 'new@example.com', customRedirectUri: 'https://app.example/done' },
  user: { _id: 'user-1' },
};

function createDb(
  token: ChangeEmailVerificationToken | null,
  options?: {
    deletedCount?: number;
    taken?: boolean;
  },
) {
  const calls: string[] = [];
  const finds: { query: object; options?: object }[] = [];
  const deleteOnes: object[] = [];
  const deleteMany: object[] = [];
  const userQueries: object[] = [];
  const updates: { id: string; patch: unknown }[] = [];
  const db: VerifyChangeEmailDb = {
    async findToken(query, findOptions) {
      calls.push('findToken');
      finds.push({ query, options: findOptions });
      return token;
    },
    async deleteToken(query) {
      calls.push('deleteOne');
      deleteOnes.push(query);
      return { deletedCount: options?.deletedCount ?? 1 };
    },
    async deleteTokens(query) {
      calls.push('deleteMany');
      deleteMany.push(query);
    },
    async findUser(query) {
      calls.push('findUser');
      userQueries.push(query);
      return options?.taken ? { _id: 'user-2' } : null;
    },
    async updateUser(id, patch) {
      calls.push('update');
      updates.push({ id, patch });
    },
  };
  return { calls, finds, deleteOnes, deleteMany, userQueries, updates, db };
}

async function expectError(run: () => Promise<unknown>, code: status, message: string) {
  await assert.rejects(run, (err: unknown) => {
    assert.ok(err instanceof GrpcError);
    assert.equal(err.code, code);
    assert.equal(err.message, message);
    return true;
  });
}

describe('commitVerifiedEmailChange', () => {
  it('returns the current not-found message when the token is missing', async () => {
    const { db, deleteOnes, updates } = createDb(null);
    await expectError(
      () => commitVerifiedEmailChange('missing', 'https://fallback', db),
      status.NOT_FOUND,
      'Change email token does not exist',
    );
    assert.equal(deleteOnes.length, 0);
    assert.equal(updates.length, 0);
  });

  it('returns the current not-found message when the user is missing', async () => {
    const { db, deleteOnes, updates } = createDb({ ...TOKEN, user: null });
    await expectError(
      () => commitVerifiedEmailChange('token-value', 'https://fallback', db),
      status.NOT_FOUND,
      'User not found',
    );
    assert.equal(deleteOnes.length, 0);
    assert.equal(updates.length, 0);
  });

  it('writes nothing when deleteOne removes no row', async () => {
    const { db, calls, deleteMany, updates } = createDb(TOKEN, { deletedCount: 0 });
    await expectError(
      () => commitVerifiedEmailChange('token-value', 'https://fallback', db),
      status.NOT_FOUND,
      'Change email token does not exist',
    );
    assert.deepEqual(calls, ['findToken', 'deleteOne']);
    assert.equal(deleteMany.length, 0);
    assert.equal(updates.length, 0);
  });

  it('consumes every change-email token before rejecting a taken address', async () => {
    const { db, calls, deleteOnes, deleteMany, updates } = createDb(TOKEN, {
      taken: true,
    });
    await expectError(
      () => commitVerifiedEmailChange('token-value', 'https://fallback', db),
      status.ALREADY_EXISTS,
      'Email address already taken',
    );
    assert.deepEqual(deleteOnes, [
      { _id: TOKEN._id, tokenType: TokenType.CHANGE_EMAIL_TOKEN },
    ]);
    assert.deepEqual(deleteMany, [
      { user: 'user-1', tokenType: TokenType.CHANGE_EMAIL_TOKEN },
    ]);
    assert.deepEqual(calls, ['findToken', 'deleteOne', 'deleteMany', 'findUser']);
    assert.equal(updates.length, 0);
  });

  it('removes a second change-email token for the same user and redirects', async () => {
    const { db, finds, deleteMany, updates } = createDb(TOKEN);
    const result = await commitVerifiedEmailChange('token-value', 'https://fallback', db);
    assert.deepEqual(finds[0], {
      query: {
        tokenType: TokenType.CHANGE_EMAIL_TOKEN,
        token: 'token-value',
      },
      options: { populate: ['user'], readPreference: 'primary' },
    });
    assert.deepEqual(deleteMany, [
      { user: 'user-1', tokenType: TokenType.CHANGE_EMAIL_TOKEN },
    ]);
    assert.deepEqual(updates, [{ id: 'user-1', patch: { email: 'new@example.com' } }]);
    assert.deepEqual(result, { redirect: 'https://app.example/done' });
  });

  it('keeps the fallback redirect and the success string', async () => {
    const fallbackDb = createDb({
      ...TOKEN,
      data: { email: 'new@example.com' },
    });
    const redirected = await commitVerifiedEmailChange(
      'token-value',
      'https://fallback',
      fallbackDb.db,
    );
    assert.deepEqual(redirected, { redirect: 'https://fallback' });

    const plainDb = createDb({
      ...TOKEN,
      data: { email: 'new@example.com' },
    });
    const plain = await commitVerifiedEmailChange('token-value', undefined, plainDb.db);
    assert.equal(plain, 'Email changed successfully');
  });
});
