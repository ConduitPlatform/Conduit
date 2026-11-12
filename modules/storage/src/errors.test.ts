import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { getConduitCode } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from './errors.js';

describe('storage error catalog', () => {
  it('uses the key as conduitCode and keeps the status', () => {
    for (const [key, def] of Object.entries(errors)) {
      assert.equal(def.conduitCode, key);
    }
    assert.equal(errors.FILE_NOT_FOUND.grpcCode, status.NOT_FOUND);
    assert.equal(errors.STORAGE_HANDLERS_NOT_INITIALIZED.grpcCode, status.UNAVAILABLE);
  });

  it('keeps a specific message with a stable code', () => {
    const err = new ModuleError({ ...errors.FILE_ACTION_NOT_ALLOWED, message: 'custom' });
    assert.equal(getConduitCode(err), 'FILE_ACTION_NOT_ALLOWED');
    assert.equal(err.code, status.PERMISSION_DENIED);
  });
});
