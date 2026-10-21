import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { TokenType } from '../constants/TokenType.js';
import {
  CHANGE_EMAIL_MAILBOX_TOKENS,
  changeEmailRpc,
  changeUserEmail,
  type ChangeEmailDb,
  type ChangeEmailRequest,
  type ChangeEmailUser,
} from './changeEmail.js';

const USER: ChangeEmailUser = {
  _id: 'user-1',
  email: 'old@example.com',
  isAnonymous: false,
};

const MAILBOX_DELETE = {
  user: USER._id,
  tokenType: { $in: [...CHANGE_EMAIL_MAILBOX_TOKENS] },
};

function restrictions(enabled: boolean, blockedDomains: string[] = []) {
  return {
    enabled,
    blockDisposableEmails: true,
    blockPlusAddressing: true,
    blockedAddresses: [] as string[],
    blockedDomains,
    allowedAddresses: [] as string[],
    allowedDomains: [] as string[],
  };
}

type TokenRow = { user: string; email: string };

function matchesUser(user: ChangeEmailUser, query: Record<string, unknown>): boolean {
  if (typeof query._id === 'string' && user._id !== query._id) return false;
  if (query._id && typeof query._id === 'object') {
    const excluded = (query._id as { $ne?: string }).$ne;
    if (excluded && user._id === excluded) return false;
  }
  if (typeof query.email === 'string') {
    const stored = user.email == null ? '' : user.email.toLowerCase();
    if (stored !== query.email) return false;
  }
  return true;
}

function createDb(
  user: ChangeEmailUser | null,
  options?: {
    otherUser?: ChangeEmailUser | null;
    tokens?: TokenRow[];
    updated?: ChangeEmailUser | null;
    deleteError?: Error;
  },
) {
  const calls: string[] = [];
  const userQueries: object[] = [];
  const tokenQueries: object[] = [];
  const deletes: object[] = [];
  const updates: { id: string; patch: unknown }[] = [];
  const events: { event: string; payload: string }[] = [];
  const users = [user, options?.otherUser].filter((row): row is ChangeEmailUser => !!row);
  const db: ChangeEmailDb = {
    async findUser(query) {
      calls.push('findUser');
      userQueries.push(query);
      return (
        users.find(row => matchesUser(row, query as Record<string, unknown>)) ?? null
      );
    },
    async findToken(query) {
      calls.push('findToken');
      tokenQueries.push(query);
      const record = query as {
        tokenType?: string;
        'data.email'?: string;
        user?: { $ne?: string };
      };
      const hit = (options?.tokens ?? []).find(token => {
        if (record.tokenType && record.tokenType !== TokenType.CHANGE_EMAIL_TOKEN) {
          return false;
        }
        if (record['data.email'] && token.email !== record['data.email']) return false;
        if (record.user?.$ne && token.user === record.user.$ne) return false;
        return true;
      });
      return hit ?? null;
    },
    async deleteTokens(query) {
      calls.push('delete');
      deletes.push(query);
      if (options?.deleteError) throw options.deleteError;
    },
    async updateUser(id, patch) {
      calls.push('update');
      updates.push({ id, patch });
      if (options && 'updated' in options) return options.updated ?? null;
      return { ...(user as ChangeEmailUser), ...patch };
    },
    publish(event, payload) {
      calls.push('publish');
      events.push({ event, payload });
    },
  };
  return { calls, userQueries, tokenQueries, deletes, updates, events, db };
}

async function expectError(
  request: ChangeEmailRequest,
  db: ChangeEmailDb,
  code: status,
  message: string,
) {
  await assert.rejects(
    () => changeUserEmail(request, db),
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
    ConfigController.getInstance().config = {
      emailRestrictions: restrictions(false),
    };
  });

  it('requires email or userId', async () => {
    const { db, calls } = createDb(USER);
    await expectError(
      { newEmail: 'new@example.com' },
      db,
      status.INVALID_ARGUMENT,
      'email or userId is required',
    );
    assert.deepEqual(calls, []);
  });

  it('treats an empty identifier as missing', async () => {
    const { db } = createDb(USER);
    await expectError(
      { email: '', userId: '', newEmail: 'new@example.com' },
      db,
      status.INVALID_ARGUMENT,
      'email or userId is required',
    );
  });

  it('uses the user id when email is empty', async () => {
    const { db, userQueries, updates } = createDb(USER);
    const result = await changeUserEmail(
      { email: '', userId: USER._id, newEmail: 'new@example.com' },
      db,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(userQueries[0], { _id: USER._id });
    assert.deepEqual(updates[0].patch, { email: 'new@example.com' });
  });

  it('uses the email when userId is empty', async () => {
    const { db, userQueries } = createDb(USER);
    await changeUserEmail(
      { email: 'old@example.com', userId: '', newEmail: 'new@example.com' },
      db,
    );
    assert.deepEqual(userQueries[0], { email: 'old@example.com' });
  });

  it('returns not found when the email does not match a user', async () => {
    const { db, deletes } = createDb(null);
    await expectError(
      { email: 'missing@example.com', newEmail: 'new@example.com' },
      db,
      status.NOT_FOUND,
      'User not found',
    );
    assert.equal(deletes.length, 0);
  });

  it('returns not found when the user id does not match a user', async () => {
    const { db } = createDb(USER);
    await expectError(
      { userId: 'other-id', newEmail: 'new@example.com' },
      db,
      status.NOT_FOUND,
      'User not found',
    );
  });

  it('rejects a user id whose stored email does not match', async () => {
    const { db, deletes } = createDb(USER);
    await expectError(
      { userId: USER._id, email: 'other@example.com', newEmail: 'new@example.com' },
      db,
      status.INVALID_ARGUMENT,
      'Email does not match user',
    );
    assert.equal(deletes.length, 0);
  });

  it('accepts a stored address that differs only by case', async () => {
    const { db, updates } = createDb({ ...USER, email: 'Old@Example.com' });
    const result = await changeUserEmail(
      { userId: USER._id, email: 'OLD@example.com', newEmail: 'new@example.com' },
      db,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(updates[0].patch, { email: 'new@example.com' });
  });

  it('rejects the same address', async () => {
    const { db } = createDb(USER);
    await expectError(
      { email: 'OLD@example.com', newEmail: 'old@example.com' },
      db,
      status.INVALID_ARGUMENT,
      'The new email can not be the same as the old email',
    );
  });

  it('reports the same address before the anonymous-user error', async () => {
    const { db, calls } = createDb({ ...USER, isAnonymous: true });
    await expectError(
      { email: USER.email!, newEmail: 'OLD@example.com' },
      db,
      status.INVALID_ARGUMENT,
      'The new email can not be the same as the old email',
    );
    assert.equal(calls.includes('delete'), false);
  });

  it('rejects anonymous users', async () => {
    const { db, deletes } = createDb({ ...USER, isAnonymous: true });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      db,
      status.PERMISSION_DENIED,
      'Anonymous user',
    );
    assert.equal(deletes.length, 0);
  });

  it('rejects an invalid address', async () => {
    const { db } = createDb(USER);
    await expectError(
      { email: USER.email!, newEmail: 'not-an-email' },
      db,
      status.INVALID_ARGUMENT,
      'Invalid email address provided',
    );
  });

  it('rejects an empty new address', async () => {
    const { db, updates } = createDb(USER);
    await expectError(
      { email: USER.email!, newEmail: '' },
      db,
      status.INVALID_ARGUMENT,
      'Invalid email address provided',
    );
    assert.equal(updates.length, 0);
  });

  it('does not trim a leading or trailing space', async () => {
    const spacedLookup = createDb(USER);
    await expectError(
      { email: ' old@example.com', newEmail: 'new@example.com' },
      spacedLookup.db,
      status.NOT_FOUND,
      'User not found',
    );
    assert.deepEqual(spacedLookup.userQueries[0], { email: ' old@example.com' });

    const spacedTarget = createDb(USER);
    await expectError(
      { email: USER.email!, newEmail: ' new@example.com ' },
      spacedTarget.db,
      status.INVALID_ARGUMENT,
      'Invalid email address provided',
    );
    assert.equal(spacedTarget.updates.length, 0);
    assert.equal(spacedTarget.deletes.length, 0);
  });

  it('rejects the reserved anonymous domain', async () => {
    const { db } = createDb(USER);
    await expectError(
      { email: USER.email!, newEmail: 'person@anonymous.com' },
      db,
      status.INVALID_ARGUMENT,
      'This email address is not allowed',
    );
  });

  it('rejects a restricted address before the duplicate check', async () => {
    ConfigController.getInstance().config = {
      emailRestrictions: restrictions(true, ['example.com']),
    };
    const { db, userQueries } = createDb(USER, {
      otherUser: { _id: 'user-2', email: 'new@example.com' },
    });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      db,
      status.INVALID_ARGUMENT,
      'This email address is not allowed',
    );
    assert.equal(userQueries.length, 1);
  });

  it('rejects an address another user already has', async () => {
    const { db, deletes, userQueries } = createDb(USER, {
      otherUser: { _id: 'user-2', email: 'new@example.com' },
    });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      db,
      status.ALREADY_EXISTS,
      'Email address already taken',
    );
    assert.deepEqual(userQueries[1], {
      email: 'new@example.com',
      _id: { $ne: USER._id },
    });
    assert.equal(deletes.length, 0);
  });

  it('ignores this user change-email token and rejects another user token', async () => {
    const ownOnly = createDb(USER, {
      tokens: [{ user: USER._id, email: 'new@example.com' }],
    });
    const result = await changeUserEmail(
      { userId: USER._id, newEmail: 'new@example.com' },
      ownOnly.db,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(ownOnly.tokenQueries[0], {
      tokenType: TokenType.CHANGE_EMAIL_TOKEN,
      'data.email': 'new@example.com',
      user: { $ne: USER._id },
    });

    const reserved = createDb(USER, {
      tokens: [{ user: 'user-2', email: 'new@example.com' }],
    });
    await expectError(
      { userId: USER._id, newEmail: 'new@example.com' },
      reserved.db,
      status.ALREADY_EXISTS,
      'Email address already taken',
    );
    assert.equal(reserved.deletes.length, 0);
  });

  it('sets a first address for a user looked up by id', async () => {
    const phoneless = { _id: 'phone-1', email: null, isAnonymous: false };
    const { db, updates, events } = createDb(phoneless);
    const result = await changeUserEmail(
      { userId: 'phone-1', newEmail: 'first@example.com' },
      db,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(updates[0].patch, { email: 'first@example.com' });
    assert.equal(events.length, 1);
  });

  it('deletes only mailbox tokens before writing and leaves isVerified unchanged', async () => {
    const { calls, deletes, updates, events, db } = createDb(USER);
    const result = await changeUserEmail(
      { email: 'Old@Example.com', newEmail: 'New@Example.com' },
      db,
    );
    assert.deepEqual(result, { message: 'ok' });
    assert.deepEqual(
      calls.filter(call => call === 'delete' || call === 'update'),
      ['delete', 'update'],
    );
    assert.deepEqual(deletes, [MAILBOX_DELETE]);
    assert.deepEqual(
      [...CHANGE_EMAIL_MAILBOX_TOKENS],
      deletes[0] && (deletes[0] as { tokenType: { $in: string[] } }).tokenType.$in,
    );
    assert.equal(
      (deletes[0] as { tokenType: { $in: string[] } }).tokenType.$in.includes(
        TokenType.TEAM_INVITE_TOKEN,
      ),
      false,
    );
    assert.equal(calls.includes('clearKey'), false);
    assert.deepEqual(updates[0], {
      id: USER._id,
      patch: { email: 'new@example.com' },
    });
    assert.equal('isVerified' in (updates[0].patch as object), false);
    const updated = { ...USER, email: 'new@example.com' };
    assert.deepEqual(events, [
      {
        event: 'authentication:update:user',
        payload: JSON.stringify(updated),
      },
    ]);
  });

  it('does not update the user when token deletion throws', async () => {
    const { db, updates, events } = createDb(USER, { deleteError: new Error('db down') });
    await assert.rejects(() =>
      changeUserEmail({ email: USER.email!, newEmail: 'new@example.com' }, db),
    );
    assert.equal(updates.length, 0);
    assert.equal(events.length, 0);
  });

  it('writes isVerified when the caller sets it', async () => {
    const { updates, db } = createDb(USER);
    await changeUserEmail(
      { userId: USER._id, newEmail: 'new@example.com', isVerified: false },
      db,
    );
    assert.deepEqual(updates[0].patch, {
      email: 'new@example.com',
      isVerified: false,
    });
  });

  it('does not publish when the update returns nothing', async () => {
    const { events, db } = createDb(USER, { updated: null });
    await expectError(
      { email: USER.email!, newEmail: 'new@example.com' },
      db,
      status.INTERNAL,
      'Failed to update user',
    );
    assert.equal(events.length, 0);
  });
});

describe('changeEmailRpc', () => {
  beforeEach(() => {
    ConfigController.getInstance().config = {
      emailRestrictions: restrictions(false),
    };
  });

  it('returns a GrpcError on the callback with its own code', async () => {
    const { db } = createDb(null);
    const errors: { code: number; message: string }[] = [];
    await changeEmailRpc(
      { email: 'missing@example.com', newEmail: 'new@example.com' },
      db,
      error => {
        if (error) errors.push(error);
      },
    );
    assert.deepEqual(errors, [{ code: status.NOT_FOUND, message: 'User not found' }]);
  });

  it('returns any other error as INTERNAL', async () => {
    const { db } = createDb(USER, { deleteError: new Error('db down') });
    const errors: { code: number; message: string }[] = [];
    await changeEmailRpc({ userId: USER._id, newEmail: 'new@example.com' }, db, error => {
      if (error) errors.push(error);
    });
    assert.deepEqual(errors, [{ code: status.INTERNAL, message: 'db down' }]);
  });
});
