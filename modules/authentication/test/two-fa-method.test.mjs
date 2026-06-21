import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const twoFaSource = readFileSync(
  new URL('../src/handlers/twoFa.ts', import.meta.url),
  'utf8',
);
const authSource = readFileSync(
  new URL('../src/Authentication.ts', import.meta.url),
  'utf8',
);
const userAdminSource = readFileSync(
  new URL('../src/admin/user.ts', import.meta.url),
  'utf8',
);
const migrationsSource = readFileSync(
  new URL('../src/migrations/index.ts', import.meta.url),
  'utf8',
);

test('SMS 2FA enable persists canonical twoFaMethod sms', () => {
  assert.match(twoFaSource, /twoFaMethod:\s*'sms'/);
  assert.doesNotMatch(twoFaSource, /twoFaMethod:\s*'phone'/);
});

test('login and beginTwoFa paths use sms with legacy phone normalization', () => {
  assert.match(twoFaSource, /function normalizeTwoFaMethod/);
  assert.match(twoFaSource, /if \(method === 'phone'\)/);
  assert.match(twoFaSource, /twoFaMethod === 'sms'/);
  assert.doesNotMatch(twoFaSource, /twoFaMethod === 'phone'/);
});

test('admin user patch defaults twoFaMethod to sms', () => {
  assert.match(userAdminSource, /twoFaMethod = user\.twoFaMethod \?\? 'sms'/);
  assert.doesNotMatch(userAdminSource, /twoFaMethod = user\.twoFaMethod \?\? 'phone'/);
});

test('backup code routes gate on backUpCodes.enabled', () => {
  assert.match(twoFaSource, /config\.twoFa\.backUpCodes\?\.enabled/);
  assert.doesNotMatch(
    twoFaSource,
    /if \(ConfigController\.getInstance\(\)\.config\.twoFa\.backUpCodes\) \{/,
  );
});

test('startup migration renames legacy phone twoFaMethod to sms', () => {
  assert.match(migrationsSource, /twoFaMethod: 'phone'/);
  assert.match(migrationsSource, /twoFaMethod: 'sms'/);
  assert.match(migrationsSource, /updateMany/);
});

test('UserCreateByUsername is registered on the gRPC service', () => {
  assert.match(authSource, /userCreateByUsername: this\.userCreateByUsername\.bind\(this\)/);
});
