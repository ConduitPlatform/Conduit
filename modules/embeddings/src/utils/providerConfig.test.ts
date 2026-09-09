import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  findProviderModel,
  normalizeEmbeddingsConfig,
  normalizeProviderSettings,
  resolveProviderModelName,
  assertConfiguredProvider,
  resolveCatalogueDimensions,
  resolveCatalogueModel,
} from './providerConfig.js';

describe('provider model catalogue', () => {
  it('migrates a singular model setting into a one-item catalogue', () => {
    const migrated = normalizeProviderSettings({
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      allowedHosts: ['api.openai.com'],
    });
    assert.deepEqual(migrated, {
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test',
      models: [{ name: 'text-embedding-3-small', dimensions: 1536 }],
      defaultModel: 'text-embedding-3-small',
    });
  });

  it('keeps an existing catalogue and drops legacy host and model fields', () => {
    const normalized = normalizeProviderSettings({
      endpoint: 'https://api.openai.com/v1/embeddings',
      model: 'legacy-model',
      dimensions: 512,
      allowedHosts: ['api.openai.com'],
      models: [
        { name: 'text-embedding-3-small', dimensions: 1536 },
        { name: 'text-embedding-3-large', dimensions: 3072 },
      ],
      defaultModel: 'text-embedding-3-large',
    });
    assert.deepEqual(normalized.models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
      { name: 'text-embedding-3-large', dimensions: 3072 },
    ]);
    assert.equal(normalized.defaultModel, 'text-embedding-3-large');
    assert.equal('model' in normalized, false);
    assert.equal('allowedHosts' in normalized, false);
    assert.equal('dimensions' in normalized, false);
  });

  it('rejects duplicate names, empty names, and non-positive dimensions', () => {
    assert.throws(
      () =>
        normalizeProviderSettings({
          models: [
            { name: 'small', dimensions: 1536 },
            { name: 'small', dimensions: 768 },
          ],
        }),
      err => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => normalizeProviderSettings({ models: [{ name: '  ', dimensions: 1536 }] }),
      err => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => normalizeProviderSettings({ models: [{ name: 'small', dimensions: 0 }] }),
      err => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => normalizeProviderSettings({ model: 'small' }),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /positive integer/.test(err.message),
    );
  });

  it('requires defaultModel to exist in the catalogue when set', () => {
    assert.throws(
      () =>
        normalizeProviderSettings({
          models: [{ name: 'small', dimensions: 1536 }],
          defaultModel: 'missing',
        }),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /not in the catalogue/.test(err.message),
    );
    const normalized = normalizeProviderSettings({
      models: [
        { name: 'small', dimensions: 1536 },
        { name: 'large', dimensions: 3072 },
      ],
    });
    assert.equal(normalized.defaultModel, undefined);
    assert.equal(resolveProviderModelName(normalized, 'large'), 'large');
    assert.equal(resolveProviderModelName(normalized), 'small');
    assert.equal(findProviderModel(normalized, 'large')?.dimensions, 3072);
    assert.equal(findProviderModel(normalized, 'missing'), undefined);
    const preferred = normalizeProviderSettings({
      models: [
        { name: 'small', dimensions: 1536 },
        { name: 'large', dimensions: 3072 },
      ],
      defaultModel: 'large',
    });
    assert.equal(resolveProviderModelName(preferred), 'large');
    assert.equal(resolveCatalogueModel(preferred).name, 'large');
    assert.equal(resolveCatalogueDimensions(resolveCatalogueModel(preferred)), 3072);
  });

  it('resolves configured providers and catalogue dimensions, rejecting mismatches', () => {
    const providers = {
      'openai-compatible': {
        models: [
          { name: 'small', dimensions: 1536 },
          { name: 'large', dimensions: 3072 },
        ],
        defaultModel: 'small',
      },
    };
    assert.equal(
      assertConfiguredProvider(providers, 'openai-compatible').name,
      'openai-compatible',
    );
    assert.throws(
      () => assertConfiguredProvider(providers, 'missing'),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /not a configured provider/.test(err.message),
    );
    assert.equal(resolveCatalogueModel(providers['openai-compatible']).name, 'small');
    assert.equal(
      resolveCatalogueDimensions(providers['openai-compatible'].models![1], 0),
      3072,
    );
    assert.throws(
      () => resolveCatalogueDimensions(providers['openai-compatible'].models![0], 768),
      err =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /do not match catalogue dimensions/.test(err.message),
    );
  });

  it('allows an empty catalogue and does not throw on incomplete legacy reads', () => {
    assert.deepEqual(normalizeProviderSettings({ endpoint: 'https://api.example/v1' }), {
      endpoint: 'https://api.example/v1',
      models: [],
    });
    assert.deepEqual(normalizeProviderSettings({ model: 'small' }, { strict: false }), {
      models: [],
    });
  });

  it('strips requireGrpcKey and returns catalogue-shaped providers', () => {
    const normalized = normalizeEmbeddingsConfig({
      enabled: true,
      security: {
        requireGrpcKey: true,
        sourceFieldAllowlist: [],
      },
      providers: {
        'openai-compatible': {
          endpoint: 'https://api.openai.com/v1/embeddings',
          model: 'text-embedding-3-small',
          dimensions: 1536,
        },
      },
    });
    assert.equal(
      'requireGrpcKey' in (normalized.security as Record<string, unknown>),
      false,
    );
    assert.deepEqual(
      (normalized.providers['openai-compatible'] as { models?: unknown }).models,
      [{ name: 'text-embedding-3-small', dimensions: 1536 }],
    );
  });
});
