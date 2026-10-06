import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import {
  merge,
  reconcileStoredModuleConfig,
  restoreRedactedSecrets,
} from '@conduitplatform/module-tools';
import AppConfigSchema, { type Config } from '../config/index.js';
import { normalizeEmbeddingsConfig } from './providerConfig.js';

describe('embeddings module config lifecycle', () => {
  it('migrates stored legacy provider settings and keeps them across setConfig', async () => {
    const schema = convict(AppConfigSchema);
    const stored = normalizeEmbeddingsConfig({
      ...schema.getProperties(),
      providers: {
        'openai-compatible': {
          endpoint: 'https://api.openai.com/v1/embeddings',
          apiKey: 'sk-live',
          model: 'text-embedding-3-small',
          dimensions: 1536,
          models: [],
          allowedHosts: ['api.openai.com'],
        },
      },
      security: {
        ...schema.getProperties().security,
        requireGrpcKey: true,
      },
    } as unknown as Config);
    schema.load(stored).validate({ allowed: 'warn' });
    let persistCalls = 0;
    const reconciled = await reconcileStoredModuleConfig({
      stored: {
        providers: {
          'openai-compatible': {
            endpoint: 'https://api.openai.com/v1/embeddings',
            apiKey: 'sk-live',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            models: [],
            allowedHosts: ['api.openai.com'],
          },
        },
        security: { requireGrpcKey: true, sourceFieldAllowlist: [] },
      } as unknown as Config,
      migrated: schema.getProperties() as Config,
      configureOverride: async config => {
        persistCalls += 1;
        return config;
      },
    });
    assert.equal(persistCalls, 1);
    schema.load(reconciled.config);

    const previous = schema.getProperties() as Config;
    let next = merge(previous, { enabled: true } as Config);
    next = restoreRedactedSecrets(next, previous, AppConfigSchema);
    next = normalizeEmbeddingsConfig(next);
    schema.load(next).validate({ allowed: 'warn' });
    const patched = schema.getProperties();
    const provider = patched.providers['openai-compatible'];
    assert.equal(patched.enabled, true);
    assert.equal(provider.apiKey, 'sk-live');
    assert.deepEqual(provider.models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
    assert.equal(provider.defaultModel, 'text-embedding-3-small');
    assert.equal('model' in provider, false);
    assert.equal('dimensions' in provider, false);
    assert.equal('allowedHosts' in provider, false);
    assert.equal('requireGrpcKey' in patched.security, false);
  });
});
