import { describe, expect, it } from '@jest/globals';
import { hasOperatorKeys, validateInputs } from '../handlers/CustomEndpoints/utils.js';

const inputs = [
  { name: 'title', type: 'String', location: 0 },
  { name: 'count', type: 'Number', location: 1 },
  { name: 'flag', type: 'Boolean', location: 1 },
  { name: 'owner', type: 'ObjectId', location: 1 },
  { name: 'since', type: 'Date', location: 1 },
  { name: 'ids', type: 'String', location: 1, array: true },
  { name: 'meta', type: 'JSON', location: 0, optional: true },
];

const failsWith = (params: Record<string, unknown>) =>
  expect(() => validateInputs(inputs, params)).toThrow(/CUSTOM_ENDPOINT_INPUT_INVALID/);

describe('custom endpoint input checks', () => {
  it('accepts plain scalar, array and JSON inputs', () => {
    expect(() =>
      validateInputs(inputs, {
        title: 'a',
        count: 1,
        flag: false,
        owner: '507f1f77bcf86cd799439011',
        since: new Date(),
        ids: ['a', 'b'],
        meta: { nested: { ok: [1, 2] } },
      }),
    ).not.toThrow();
  });

  it('ignores missing optional values', () => {
    expect(() => validateInputs(inputs, {})).not.toThrow();
  });

  it('rejects objects for scalar inputs', () => {
    failsWith({ title: { $ne: null } });
    failsWith({ count: { $gt: 0 } });
    failsWith({ flag: { a: 1 } });
    failsWith({ owner: { $in: [] } });
    failsWith({ since: { $lt: 1 } });
  });

  it('rejects arrays for non-array scalar inputs', () => {
    failsWith({ title: ['a'] });
  });

  it('rejects objects inside scalar arrays', () => {
    failsWith({ ids: ['a', { $ne: 'b' }] });
    failsWith({ ids: { $in: ['a'] } });
  });

  it('rejects operator keys at any depth for JSON inputs', () => {
    failsWith({ meta: { $set: { a: 1 } } });
    failsWith({ meta: { a: [{ b: { $inc: 1 } }] } });
  });
});

describe('hasOperatorKeys', () => {
  it('detects $-prefixed keys at any depth', () => {
    expect(hasOperatorKeys({ a: { b: [{ $x: 1 }] } })).toBe(true);
    expect(hasOperatorKeys({ a: { b: 1 } })).toBe(false);
    expect(hasOperatorKeys(null)).toBe(false);
    expect(hasOperatorKeys('$x')).toBe(false);
  });
});
