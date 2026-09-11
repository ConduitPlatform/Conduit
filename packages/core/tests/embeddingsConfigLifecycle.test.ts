import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import { merge as lodashMerge } from 'lodash-es';
import {
  merge,
  reconcileStoredModuleConfig,
  redactSensitiveConfig,
  restoreRedactedSecrets,
} from '@conduitplatform/module-tools';
import { getModuleConfigRoute } from '../dist/admin/routes/GetModuleConfig.route.js';
import { setModuleConfigRoute } from '../dist/admin/routes/SetModuleConfig.route.js';
import AppConfigSchema, {
  type Config,
} from '../../../modules/embeddings/dist/config/index.js';
import { normalizeEmbeddingsConfig } from '../../../modules/embeddings/dist/utils/providerConfig.js';

const MODULE_NAME = 'embeddings';
const STORE_KEY = `moduleConfigs.${MODULE_NAME}`;

const legacyStored = {
  enabled: false,
  defaultProvider: 'openai-compatible',
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
  queue: {
    concurrency: 2,
    attempts: 3,
    maxBatchSize: 500,
    drainTimeoutMs: 15 * 60 * 1000,
  },
  security: {
    requireGrpcKey: true,
    sourceFieldAllowlist: [],
    maxMutationEventIds: 500,
    embedTimeoutMs: 10_000,
    maxEmbedInputBytes: 32 * 1024,
    maxEmbedResponseBytes: 1024 * 1024,
  },
};

function providerOf(config: Record<string, unknown>) {
  const providers = config.providers as Record<string, Record<string, unknown>>;
  return providers['openai-compatible'];
}

describe('embeddings Admin GET/PATCH config lifecycle', () => {
  it('persists catalogue migration so an unrelated PATCH cannot wipe it', async () => {
    const store = new Map<string, string>();
    store.set(STORE_KEY, JSON.stringify(legacyStored));
    const schema = convict(AppConfigSchema);
    let configureCalls = 0;

    const local = normalizeEmbeddingsConfig(schema.getProperties() as Config);
    const existing = JSON.parse(store.get(STORE_KEY)!) as Config;
    const merged = lodashMerge({}, local, existing) as Config;
    store.set(STORE_KEY, JSON.stringify(merged));

    const migrated = normalizeEmbeddingsConfig(merged);
    schema.load(migrated).validate({ allowed: 'warn' });
    const persistable = schema.getProperties() as Config;
    const reconciled = await reconcileStoredModuleConfig({
      stored: merged,
      migrated: persistable,
      configureOverride: async next => {
        configureCalls += 1;
        store.set(STORE_KEY, JSON.stringify(next));
        return next;
      },
    });
    schema.load(reconciled.config);
    assert.equal(configureCalls, 1);

    const second = await reconcileStoredModuleConfig({
      stored: JSON.parse(store.get(STORE_KEY)!) as Config,
      migrated: schema.getProperties() as Config,
      configureOverride: async next => {
        configureCalls += 1;
        store.set(STORE_KEY, JSON.stringify(next));
        return next;
      },
    });
    assert.equal(second.persisted, false);
    assert.equal(configureCalls, 1);

    const storedAfterLifecycle = JSON.parse(store.get(STORE_KEY)!) as Record<
      string,
      unknown
    >;
    const storedProvider = providerOf(storedAfterLifecycle);
    assert.deepEqual(storedProvider.models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
    assert.equal(storedProvider.defaultModel, 'text-embedding-3-small');
    assert.equal(storedProvider.apiKey, 'sk-live');
    assert.equal('model' in storedProvider, false);
    assert.equal('dimensions' in storedProvider, false);
    assert.equal('allowedHosts' in storedProvider, false);
    const storedSecurity = storedAfterLifecycle.security as Record<string, unknown>;
    assert.equal('requireGrpcKey' in storedSecurity, false);

    const grpcSdk = {
      state: {
        getKey: async (key: string) => store.get(key) ?? null,
      },
      getModuleClient: () => ({
        setConfig: async ({ newConfig }: { newConfig: string }) => {
          const previous = schema.getProperties() as Config;
          let next = merge(previous, JSON.parse(newConfig) as Config);
          next = restoreRedactedSecrets(next, previous, AppConfigSchema);
          next = normalizeEmbeddingsConfig(next);
          schema.load(next).validate({ allowed: 'warn' });
          return { updatedConfig: JSON.stringify(schema.getProperties()) };
        },
      }),
    };
    const configManager = {
      set: async (_name: string, config: unknown) => {
        store.set(STORE_KEY, JSON.stringify(config));
        return config;
      },
    };

    const getRoute = getModuleConfigRoute(grpcSdk as never, MODULE_NAME, AppConfigSchema);
    const getResponse = await getRoute.executeRequest({} as never);
    const getProvider = providerOf(getResponse.config);
    assert.equal(getProvider.apiKey, '[REDACTED]');
    assert.deepEqual(getProvider.models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
    assert.equal(getProvider.defaultModel, 'text-embedding-3-small');
    assert.equal('model' in getProvider, false);
    assert.equal('dimensions' in getProvider, false);
    assert.equal('allowedHosts' in getProvider, false);
    assert.doesNotMatch(JSON.stringify(getResponse), /sk-live/);
    assert.equal(
      redactSensitiveConfig(getResponse.config, AppConfigSchema).providers[
        'openai-compatible'
      ].apiKey,
      '[REDACTED]',
    );

    const patchRoute = setModuleConfigRoute(
      grpcSdk as never,
      configManager,
      MODULE_NAME,
      AppConfigSchema,
    );
    const patchResponse = await patchRoute.executeRequest({
      params: { config: { enabled: true } },
    } as never);
    assert.equal(patchResponse.config.enabled, true);
    assert.equal(
      patchResponse.config.providers['openai-compatible'].apiKey,
      '[REDACTED]',
    );
    assert.deepEqual(patchResponse.config.providers['openai-compatible'].models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);

    const storedAfterPatch = JSON.parse(store.get(STORE_KEY)!) as Record<string, unknown>;
    const patchedProvider = providerOf(storedAfterPatch);
    assert.equal(storedAfterPatch.enabled, true);
    assert.deepEqual(patchedProvider.models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
    assert.equal(patchedProvider.defaultModel, 'text-embedding-3-small');
    assert.equal(patchedProvider.apiKey, 'sk-live');
    assert.equal('model' in patchedProvider, false);
    assert.equal('dimensions' in patchedProvider, false);

    const getAfterPatch = await getRoute.executeRequest({} as never);
    assert.deepEqual(providerOf(getAfterPatch.config).models, [
      { name: 'text-embedding-3-small', dimensions: 1536 },
    ]);
    assert.equal(providerOf(getAfterPatch.config).apiKey, '[REDACTED]');
  });
});
