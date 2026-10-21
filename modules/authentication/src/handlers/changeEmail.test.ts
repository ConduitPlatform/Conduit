import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import {
  CHANGE_EMAIL_MAILBOX_TOKENS,
  changeUserEmail,
  type ChangeEmailRequest,
  type ChangeEmailStores,
  type ChangeEmailUser,
} from './changeEmail.js';

const USER: ChangeEmailUser = {
  _id: 'user-1',
  email: 'old@example.com',
  isAnonymous: false,
};

function restrictionsOff() {
  return {
    enabled: false,
    blockDisposableEmails: true,
    blockPlusAddressing: true,
    blockedAddresses: [],
    blockedDomains: [],
    allowedAddresses: [],
    allowedDomains: [],
  };
}

function createStores(
  user: ChangeEmailUser | null,
  options?: {
    otherUser?: ChangeEmailUser | null;
    otherToken?: unknown | null;
    updated?: ChangeEmailUser | null;
  },
) {
  const calls: string[] = [];
  const deletes: { userId: string; tokenTypes: readonly string[] }[] = [];
  const updates: { id: string; patch: unknown }[] = [];
  const published: ChangeEmailUser[] = [];
  const stores: ChangeEmailStores = {
    async findUserById(id) {
      calls.push(`findId:${id}`);
      return user && user._id === id ? user : null;
    },
    async findUserByEmail(email) {
      calls.push(`findEmail:${email}`);
      return user && user.email?.toLowerCase() === email ? user : null;
    },
    async findOtherUserByEmail(email, userId) {
      calls.push(`otherUser:${email}:${userId}`);
      const other = options?.otherUser;
      if (!other || other._id === userId) return null;
      return other.email?.toLowerCase() === email ? other : null;
    },
    async findOtherChangeEmailToken(email, userId) {
      calls.push(`otherToken:${email}:${userId}`);
      return options?.otherToken ?? null;
    },
    async deleteMailboxTokens(userId, tokenTypes) {
      calls.push('delete');
      deletes.push({ userId, tokenTypes });
    },
    async updateUser(id, patch) {
      calls.push('update');
      updates.push({ id, patch });
      if (options && 'updated' in options) return options.updated ?? null;
      return { ...user!, ...patch };
    },
    publish(updatedUser) {
      calls.push('publish');
      published.push(updatedUser);
    },
  };
  return { calls, deletes, updates, published, stores };
}

async function expectError(
  request: ChangeEmailRequest,
  stores: ChangeEmailStores,
  code: status,
  message: string,
) {
  await assert.rejects(
    () => changeUserEmail(request, stores),
    (err: unknown) => {
      assert.ok(err instanceof GrpcError);
      assert.equal(err.code, code);
      assert.equal(err.message, message);
      return true;
    },
  );
}

describe('changeUserEmail', () => {
  beforeEach(() => {
    ConfigController.getInstance().config = { emailRestrictions: restrictionsOff() };
  });

  it('requires email or userId', async () => {
    const { stores, calls } = createStores(USER);
    await expectError(
      { newEmail: 'new@example.com' },
      stores,
      status.INVALID_ARGUMENT,
      'email or userId is required',
    );
    assert.deepEqual(calls, []);
  });

  it('treats an empty identifier as missing', async () => {
    const { stores } = createStores(USER);
    await expectError(
      { email: '', userId: '', newEmail: 'new@example.com' },
      stores,
      status.INVALID_ARGUMENT,
      'email or userId is required',
    );
  });

  it('returns not found when the email does not match a user', async () => {
    const { stores, deletes } = createStores(null);
    await expectError(
      { email: 'missing@example.com', newEmail: 'new@example.com' },
      stores,
      status.NOT_FOUND,
      'User not found',
    );
    assert.equal(deletes.length, 0);
  });

  it('returns not found when the user id does not match a user', async () => {
    const { stores } = createStores(USER);
    await expectError(
      { userId: 'other-id', newEmail: 'new@example.com' },
      stores,
      status.NOT_FOUND,
      'User not found',
    );
  });

  it('rejects a user id whose stored email does not match', async () => {
    const { stores, deletes } = createStores(USER);
    await expectError(
      { userId: USER._id, email: 'other@example.com', newEmail: 'new@example.com' },
      stores,
      status.INVALID_ARGUMENT,
      'email does not match user',
    );
    assert.equal(deletes.length, 0);
  });

  it('rejects the same address', async () => {
    const { stores } = createStores(USER);
    await expectError(
      { email: 'OLD@example.com', newEmail: 'old@example.com' },
      stores,
      status.INVALID_ARGUMENT,
      'The new email can not be the same as the old email',
    );
  });

  it('rejects anonymous users', async () => {
    const { stores, deletes } = createStores({ ...USER, isAnonymous: true });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      stores,
      status.PERMISSION_DENIED,
      'Anonymous user',
    );
    assert.equal(deletes.length, 0);
  });

  it('rejects an invalid address', async () => {
    const { stores } = createStores(USER);
    await expectError(
      { email: USER.email!, newEmail: 'not-an-email' },
      stores,
      status.INVALID_ARGUMENT,
      'Invalid email address provided',
    );
  });

  it('rejects the reserved anonymous domain', async () => {
    const { stores } = createStores(USER);
    await expectError(
      { email: USER.email!, newEmail: 'person@anonymous.com' },
      stores,
      status.INVALID_ARGUMENT,
      'This email address is not allowed',
    );
  });

  it('rejects an address another user already has', async () => {
    const { stores, deletes } = createStores(USER, {
      otherUser: { _id: 'user-2', email: 'new@example.com' },
    });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      stores,
      status.ALREADY_EXISTS,
      'Email address already taken',
    );
    assert.equal(deletes.length, 0);
  });

  it('rejects an address reserved by another user change-email token', async () => {
    const { stores, calls } = createStores(USER, { otherToken: { _id: 'token-1' } });
    await expectError(
      { userId: USER._id, newEmail: 'new@example.com' },
      stores,
      status.ALREADY_EXISTS,
      'Email address already taken',
    );
    assert.equal(calls.includes('delete'), false);
  });

  it('sets a first address for a user looked up by id', async () => {
    const phoneless = { _id: 'phone-1', email: null, isAnonymous: false };
    const { stores, updates, published } = createStores(phoneless);
    const result = await changeUserEmail(
      { userId: 'phone-1', newEmail: 'first@example.com' },
      stores,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(updates[0].patch, { email: 'first@example.com' });
    assert.equal(published.length, 1);
  });

  it('deletes mailbox tokens before writing and leaves isVerified unchanged', async () => {
    const { calls, deletes, updates, published, stores } = createStores(USER);
    const result = await changeUserEmail(
      { email: 'Old@Example.com', newEmail: 'New@Example.com' },
      stores,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(
      calls.filter(call => call === 'delete' || call === 'update'),
      ['delete', 'update'],
    );
    assert.deepEqual(deletes, [
      { userId: USER._id, tokenTypes: CHANGE_EMAIL_MAILBOX_TOKENS },
    ]);
    assert.deepEqual(updates[0], {
      id: USER._id,
      patch: { email: 'new@example.com' },
    });
    assert.equal(published[0].email, 'new@example.com');
    assert.equal('isVerified' in updates[0].patch, false);
  });

  it('writes isVerified when the caller sets it', async () => {
    const { updates, stores } = createStores(USER);
    await changeUserEmail(
      { userId: USER._id, newEmail: 'new@example.com', isVerified: false },
      stores,
    );
    assert.deepEqual(updates[0].patch, {
      email: 'new@example.com',
      isVerified: false,
    });
  });

  it('does not publish when the update returns nothing', async () => {
    const { published, stores } = createStores(USER, { updated: null });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      stores,
      status.INTERNAL,
      'Failed to update user',
    );
    assert.equal(published.length, 0);
  });
});
