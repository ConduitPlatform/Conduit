import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { filled, hasConduitCode, isRecord, parseConduitCode } from './common.logic.js';

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    assert.equal(isRecord({}), true);
    assert.equal(isRecord({ a: 1 }), true);
    assert.equal(isRecord(null), false);
    assert.equal(isRecord([]), false);
    assert.equal(isRecord('x'), false);
    assert.equal(isRecord(undefined), false);
  });
});

describe('filled', () => {
  it('is true for strings with a non-blank character', () => {
    assert.equal(filled('a'), true);
    assert.equal(filled(' a '), true);
    assert.equal(filled(''), false);
    assert.equal(filled('   '), false);
    assert.equal(filled(null), false);
    assert.equal(filled(undefined), false);
    assert.equal(filled(1), false);
  });
});

describe('parseConduitCode / hasConduitCode', () => {
  it('reads the conduitCode of a ModuleError', () => {
    const err = new ModuleError(errors.REALM_NOT_FOUND);
    assert.equal(parseConduitCode(err), errors.REALM_NOT_FOUND.conduitCode);
    assert.equal(hasConduitCode(err, errors.REALM_NOT_FOUND), true);
    assert.equal(hasConduitCode(err, errors.REALMS_DISABLED), false);
  });

  it('is undefined for anything that is not a ModuleError with a JSON message', () => {
    assert.equal(parseConduitCode(new Error('boom')), undefined);
    assert.equal(parseConduitCode('REALM_NOT_FOUND'), undefined);
    assert.equal(parseConduitCode(null), undefined);
    assert.equal(hasConduitCode(new Error('boom'), errors.REALM_NOT_FOUND), false);
  });
});
