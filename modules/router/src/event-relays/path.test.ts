import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lookupOwnPath, parseDotPath, requireOwnPath } from './path.js';

describe('parseDotPath', () => {
  it('accepts safe own-property paths', () => {
    assert.deepEqual(parseDotPath('_id', 'Path'), ['_id']);
    assert.deepEqual(parseDotPath('document.ownerId', 'Path'), ['document', 'ownerId']);
  });

  it('rejects prototype pollution segments', () => {
    assert.throws(() => parseDotPath('__proto__.polluted', 'Path'), {
      name: 'EventRelayValidationError',
    });
    assert.throws(() => parseDotPath('constructor.prototype', 'Path'), {
      name: 'EventRelayValidationError',
    });
  });
});

describe('lookupOwnPath', () => {
  it('reads own properties only', () => {
    const payload = { document: { _id: 'abc' } };
    assert.equal(lookupOwnPath(payload, 'document._id'), 'abc');
  });

  it('does not follow inherited properties', () => {
    const payload = Object.create({ leaked: 'nope' });
    payload.own = 'yes';
    assert.equal(lookupOwnPath(payload, 'own'), 'yes');
    assert.equal(lookupOwnPath(payload, 'leaked'), undefined);
  });

  it('requireOwnPath fails closed on missing fields', () => {
    assert.throws(() => requireOwnPath({ a: 1 }, 'b', 'Resource ID path'), {
      name: 'EventRelayValidationError',
    });
  });
});
