import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactSensitiveConfig,
  restoreRedactedSecrets,
} from '@conduitplatform/module-tools';
import AppConfigSchema from '../config/index.js';
import { normalizeEmbeddingsConfig } from './providerConfig.js';
import { redactSecretText } from './redactConfig.js';

function assertNoLegacySettingsSurface(config: unknown) {
  const serialized = JSON.stringify(config);
  assert.doesNotMatch(serialized, /requireGrpcKey/);
  assert.doesNotMatch(serialized, /allowedHosts/);
  const providers = (config as { providers?: Record<string, Record<string, unknown>> })
    .providers;
  for (const provider of Object.values(providers ?? {})) {
    assert.equal('model' in provider, false);
    assert.equal('allowedHosts' in provider, false);
    assert.equal('dimensions' in provider, false);
  }
  const security = (config as { security?: Record<string, unknown> }).security;
  if (security) {
    assert.equal('requireGrpcKey' in security, false);
  }
}

describe('provider secret redaction', () => {
  it('redacts API keys from config objects and error text', () => {
    assert.equal(
      redactSensitiveConfig({ endpoint: 'https://api.openai.com', apiKey: 'sk-secret' })
        .apiKey,
      '[REDACTED]',
    );
    assert.match(
      redactSecretText('Embedding failed Bearer sk-secret apiKey=sk-secret'),
      /\[REDACTED\]/,
    );
    assert.doesNotMatch(
      redactSecretText(
        'GetFileBytes failed storageFileId=file-1 sourceUrl=https://cdn.example/file?sig=abc token=sekrit apiKey=sk-secret',
      ),
      /file-1|cdn\.example|sk-secret|sekrit|sig=abc/,
    );
    assert.match(
      redactSecretText('GetFileBytes failed storageFileId=file-1'),
      /storageFileId:\[REDACTED\]/,
    );
  });

  it('redacts convict-sensitive and well-known secret keys', () => {
    const redacted = redactSensitiveConfig(
      {
        enabled: true,
        providers: {
          'openai-compatible': {
            endpoint: 'https://api.openai.com',
            apiKey: 'sk-live',
            models: [{ name: 'text-embedding-3-small', dimensions: 1536 }],
          },
        },
      },
      {
        providers: {
          'openai-compatible': {
            apiKey: { format: 'String', default: '', sensitive: true },
            endpoint: { format: 'String', default: '' },
            models: { format: Array, default: [] },
            defaultModel: { format: 'String', default: '' },
          },
        },
      },
    );
    assert.equal(redacted.providers['openai-compatible'].apiKey, '[REDACTED]');
    assert.equal(
      redacted.providers['openai-compatible'].endpoint,
      'https://api.openai.com',
    );
    assert.deepEqual(redacted.providers['openai-compatible'].models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
  });

  it('keeps Core Admin GET/PATCH catalogue shape while redacting keys', () => {
    const legacy = {
      enabled: true,
      defaultProvider: 'openai-compatible',
      providers: {
        'openai-compatible': {
          endpoint: 'https://api.openai.com/v1/embeddings',
          apiKey: 'sk-live',
          model: 'text-embedding-3-small',
          dimensions: 1536,
          allowedHosts: ['api.openai.com'],
        },
      },
      security: {
        requireGrpcKey: true,
        sourceFieldAllowlist: ['summary'],
      },
    };
    const patched = normalizeEmbeddingsConfig(legacy);
    const getResponse = redactSensitiveConfig(patched, AppConfigSchema);
    const monoResponse = redactSensitiveConfig(patched);
    for (const redacted of [getResponse, monoResponse]) {
      const provider = redacted.providers['openai-compatible'] as {
        apiKey?: string;
        endpoint?: string;
        models?: Array<{ name: string; dimensions: number }>;
        defaultModel?: string;
      };
      assert.equal(provider.apiKey, '[REDACTED]');
      assert.doesNotMatch(JSON.stringify(redacted), /sk-live/);
      assert.equal(provider.endpoint, 'https://api.openai.com/v1/embeddings');
      assert.deepEqual(provider.models, [
        { name: 'text-embedding-3-small', dimensions: 1536 },
      ]);
      assert.equal(provider.defaultModel, 'text-embedding-3-small');
      assertNoLegacySettingsSurface(redacted);
    }
    const emptyKey = redactSensitiveConfig(
      normalizeEmbeddingsConfig({
        providers: {
          'openai-compatible': {
            endpoint: 'https://api.openai.com/v1/embeddings',
            apiKey: '',
            models: [{ name: 'text-embedding-3-small', dimensions: 1536 }],
          },
        },
      }),
      AppConfigSchema,
    );
    assert.equal(emptyKey.providers['openai-compatible'].apiKey, '');
  });

  it('restores redacted API keys from the currently stored config', () => {
    const current = normalizeEmbeddingsConfig({
      providers: {
        'openai-compatible': {
          endpoint: 'https://api.openai.com/v1/embeddings',
          apiKey: 'sk-live',
          models: [{ name: 'text-embedding-3-small', dimensions: 1536 }],
        },
      },
    });
    const incoming = redactSensitiveConfig(current, AppConfigSchema);
    const restored = restoreRedactedSecrets(incoming, current, AppConfigSchema);
    assert.equal(restored.providers['openai-compatible'].apiKey, 'sk-live');
    assert.deepEqual(restored.providers['openai-compatible'].models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
  });
});
