import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configReconcileMessage, parseConfigBusMessage } from '../src/configBus.ts';

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

  it('publishes the reconcile signal as JSON on the shared config channel', () => {
    assert.deepEqual(parseConfigBusMessage(configReconcileMessage(true)), {
      kind: 'reconcile',
      state: 'reconciling',
    });
    assert.deepEqual(parseConfigBusMessage(configReconcileMessage(false)), {
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

  it('reports malformed JSON instead of throwing', () => {
    const parsed = parseConfigBusMessage('{');
    assert.equal(parsed.kind, 'malformed');
  });
});
