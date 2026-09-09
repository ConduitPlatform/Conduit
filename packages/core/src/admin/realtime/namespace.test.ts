import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adminSocketNamespace } from './namespace.js';

describe('adminSocketNamespace', () => {
  it('mirrors the Router module namespace contract', () => {
    assert.equal(adminSocketNamespace('database'), '/database/');
    assert.throws(() => adminSocketNamespace(''), /module-name/);
    assert.throws(() => adminSocketNamespace(undefined), /module-name/);
  });
});
