import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { status } from '@grpc/grpc-js';
import { errors } from '../src/errors.ts';

describe('core error catalog', () => {
  it('keys every definition by its conduitCode', () => {
    for (const [key, definition] of Object.entries(errors)) {
      assert.equal(definition.conduitCode, key);
    }
  });

  it('keeps the message other modules still match on', () => {
    assert.equal(errors.MODULE_CONFIG_NOT_SET.message, 'Config for module not set!');
    assert.equal(errors.MODULE_CONFIG_NOT_SET.grpcCode, status.NOT_FOUND);
  });

  it('uses accurate statuses for permission and conflict failures', () => {
    assert.equal(errors.SUPER_ADMIN_REQUIRED.grpcCode, status.PERMISSION_DENIED);
    assert.equal(errors.ADMIN_USERNAME_TAKEN.grpcCode, status.ALREADY_EXISTS);
  });
});
