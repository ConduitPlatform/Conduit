import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateEventRelayInput, validateResourceId } from './validation.js';

const validInput = {
  name: 'Order paid',
  busEvent: 'database:update:Order',
  socketEvent: 'order-updated',
  resourceType: 'Order',
  resourceIdPath: '_id',
  permission: 'read',
  messageTemplate: { id: '{{payload._id}}' },
};

describe('validateEventRelayInput', () => {
  it('accepts a complete relay definition', () => {
    const parsed = validateEventRelayInput(validInput);
    assert.equal(parsed.active, true);
    assert.equal(parsed.busEvent, 'database:update:Order');
  });

  it('rejects wildcard bus channels', () => {
    assert.throws(
      () => validateEventRelayInput({ ...validInput, busEvent: 'database:update:*' }),
      { name: 'EventRelayValidationError' },
    );
  });

  it('rejects reserved socket events', () => {
    assert.throws(
      () => validateEventRelayInput({ ...validInput, socketEvent: 'subscribe' }),
      { name: 'EventRelayValidationError' },
    );
    assert.throws(
      () => validateEventRelayInput({ ...validInput, socketEvent: 'join-room' }),
      { name: 'EventRelayValidationError' },
    );
  });

  it('rejects empty required fields', () => {
    assert.throws(() => validateEventRelayInput({ ...validInput, name: '' }), {
      name: 'EventRelayValidationError',
    });
    assert.throws(
      () => validateEventRelayInput({ ...validInput, messageTemplate: undefined }),
      { name: 'EventRelayValidationError' },
    );
  });
});

describe('validateResourceId', () => {
  it('accepts object ids and uuids', () => {
    assert.equal(
      validateResourceId('507f1f77bcf86cd799439011'),
      '507f1f77bcf86cd799439011',
    );
    assert.equal(
      validateResourceId('3b2c1a90-1111-2222-3333-444444444444'),
      '3b2c1a90-1111-2222-3333-444444444444',
    );
  });

  it('rejects empty or colon-containing identifiers', () => {
    assert.throws(() => validateResourceId(''), { name: 'EventRelayValidationError' });
    assert.throws(() => validateResourceId('Team:123'), {
      name: 'EventRelayValidationError',
    });
  });
});
