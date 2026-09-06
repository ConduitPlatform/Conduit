import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitiveConfig } from '@conduitplatform/module-tools';
import { redactProviderConfig, redactSecretText } from './redactConfig.js';

describe('provider secret redaction', () => {
  it('redacts API keys from config objects and error text', () => {
    assert.equal(
      redactProviderConfig({ endpoint: 'https://api.openai.com', apiKey: 'sk-secret' })
        .apiKey,
      '[REDACTED]',
    );
    assert.match(
      redactSecretText('Embedding failed Bearer sk-secret apiKey=sk-secret'),
      /\[REDACTED\]/,
    );
    assert.doesNotMatch(
      redactSecretText('Embedding failed Bearer sk-secret apiKey=sk-secret'),
      /sk-secret/,
    );
  });

  it('redacts convict-sensitive and well-known secret keys', () => {
    const redacted = redactSensitiveConfig(
      {
        enabled: true,
        providers: {
          'openai-compatible': { endpoint: 'https://api.openai.com', apiKey: 'sk-live' },
        },
      },
      {
        providers: {
          'openai-compatible': {
            apiKey: { format: 'String', default: '', sensitive: true },
            endpoint: { format: 'String', default: '' },
          },
        },
      },
    );
    assert.equal(redacted.providers['openai-compatible'].apiKey, '[REDACTED]');
    assert.equal(
      redacted.providers['openai-compatible'].endpoint,
      'https://api.openai.com',
    );
  });
});
