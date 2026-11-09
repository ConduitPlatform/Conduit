import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseConfigBusMessage } from '../src/configBus.ts';

describe('config bus messages', () => {
  it('accepts the legacy bare reconciling signal without throwing', () => {
    assert.deepEqual(parseConfigBusMessage('reconciling'), {
      kind: 'reconcile',
      state: 'reconciling',
    });
    assert.deepEqual(parseConfigBusMessage('reconcile-done'), {
      kind: 'reconcile',
      state: 'reconcile-done',
    });
  });

  it('still parses service-discovery messages', () => {
    assert.deepEqual(
      parseConfigBusMessage(
        JSON.stringify({
          type: 'module-health',
          name: 'authentication',
          url: 'conduit-authentication-headless:5000',
          status: 1,
        }),
      ),
      {
        kind: 'module-health',
        name: 'authentication',
        url: 'conduit-authentication-headless:5000',
        status: 1,
      },
    );
    assert.deepEqual(
      parseConfigBusMessage(
        JSON.stringify({
          type: 'serving-modules-update',
          name: 'storage',
          url: 'conduit-storage-headless:5000',
        }),
      ),
      {
        kind: 'serving-modules-update',
        name: 'storage',
        url: 'conduit-storage-headless:5000',
      },
    );
  });

  it('classifies non-JSON messages as unknown instead of throwing', () => {
    assert.deepEqual(parseConfigBusMessage('{'), { kind: 'unknown', raw: '{' });
    assert.deepEqual(parseConfigBusMessage('something-else'), {
      kind: 'unknown',
      raw: 'something-else',
    });
  });

  it('flags known types with wrong fields as invalid', () => {
    assert.equal(
      parseConfigBusMessage(JSON.stringify({ type: 'module-health', name: 'a' })).kind,
      'invalid',
    );
    assert.equal(
      parseConfigBusMessage(JSON.stringify({ type: 'serving-modules-update', url: 1 }))
        .kind,
      'invalid',
    );
    assert.equal(parseConfigBusMessage(JSON.stringify({ type: 'other' })).kind, 'ignore');
  });
});
