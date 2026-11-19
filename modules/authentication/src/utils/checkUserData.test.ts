import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getConduitCode } from '@conduitplatform/grpc-sdk';
import { User } from '../models/index.js';
import { AuthUtils } from './index.js';
import { createFakeDatabase } from './fakeDatabase.testutil.js';

const { database } = createFakeDatabase();
User.getInstance(database);

function rejects(data: Record<string, unknown>) {
  assert.throws(
    () => AuthUtils.checkUserData(data),
    (err: any) => getConduitCode(err) === 'USER_DATA_INVALID',
  );
}

describe('checkUserData', () => {
  it('accepts plain custom data', () => {
    assert.doesNotThrow(() =>
      AuthUtils.checkUserData({
        nickname: 'a',
        prefs: { theme: 'dark', tags: ['x', 'y'] },
      }),
    );
  });

  it('rejects built-in user fields', () => {
    rejects({ isVerified: true });
  });

  it('rejects top-level operator keys', () => {
    rejects({ $set: { isVerified: true, hasTwoFA: false } });
  });

  it('rejects nested operator keys', () => {
    rejects({ prefs: { deep: { $inc: { x: 1 } } } });
  });

  it('rejects operator keys inside arrays', () => {
    rejects({ list: [{ ok: 1 }, { $unset: 1 }] });
  });

  it('rejects dotted paths at any depth', () => {
    rejects({ 'a.b': 1 });
    rejects({ prefs: { 'a.b': 1 } });
  });
});

describe('hasOperatorKeys', () => {
  it('ignores primitives and null', () => {
    assert.equal(AuthUtils.hasOperatorKeys(null), false);
    assert.equal(AuthUtils.hasOperatorKeys('$set'), false);
    assert.equal(AuthUtils.hasOperatorKeys(['$a', 1]), false);
  });
});
