import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsRedactedMarker,
  reconcileStoredModuleConfig,
  storedConfigsEquivalent,
} from '../../dist/index.esm.js';

describe('stored module config reconciliation', () => {
  it('persists migrated config once and skips equivalent follow-ups', async () => {
    const stored = {
      providers: {
        'openai-compatible': {
          model: 'text-embedding-3-small',
          dimensions: 1536,
          models: [],
        },
      },
    };
    const migrated = {
      providers: {
        'openai-compatible': {
          models: [{ name: 'text-embedding-3-small', dimensions: 1536 }],
          defaultModel: 'text-embedding-3-small',
        },
      },
    };
    let overrideCalls = 0;
    const first = await reconcileStoredModuleConfig({
      stored,
      migrated,
      configureOverride: async config => {
        overrideCalls += 1;
        return config;
      },
    });
    assert.equal(first.persisted, true);
    assert.equal(overrideCalls, 1);
    assert.equal(storedConfigsEquivalent(first.config, migrated), true);

    const second = await reconcileStoredModuleConfig({
      stored: first.config,
      migrated,
      configureOverride: async config => {
        overrideCalls += 1;
        return config;
      },
    });
    assert.equal(second.persisted, false);
    assert.equal(overrideCalls, 1);
  });

  it('does not persist redacted secrets', async () => {
    let overrideCalls = 0;
    const result = await reconcileStoredModuleConfig({
      stored: { apiKey: 'sk-live' },
      migrated: { apiKey: '[REDACTED]' },
      configureOverride: async config => {
        overrideCalls += 1;
        return config;
      },
    });
    assert.equal(result.persisted, false);
    assert.equal(overrideCalls, 0);
    assert.equal(containsRedactedMarker({ apiKey: '[REDACTED]' }), true);
  });
});
