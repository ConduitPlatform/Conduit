import { VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import type { EmbeddingProviderSettings } from '../config/index.js';
import {
  assertConfiguredProvider,
  resolveCatalogueDimensions,
  resolveCatalogueModel,
} from './providerConfig.js';
import { assertSourceFields } from './schemaPolicy.js';

export interface EmbeddingConfigInput {
  schemaName?: string;
  sourceFields?: string[];
  targetField?: string;
  provider?: string;
  model?: string;
  dimensions?: number;
  similarity?: string;
  sourceFieldAllowlist?: string[];
}

export interface ValidatedEmbeddingConfig {
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: VectorSimilarity;
  sourceFieldAllowlist: string[];
}

export interface EmbeddingConfigDefaults {
  provider: string;
  providers: Record<string, EmbeddingProviderSettings>;
}

const SUPPORTED_SIMILARITY = Object.values(VectorSimilarity);

export function validateEmbeddingConfigInput(
  request: EmbeddingConfigInput,
  defaults: EmbeddingConfigDefaults,
  schemaFields?: Record<string, unknown>,
): ValidatedEmbeddingConfig {
  if (!request.schemaName || !request.targetField || !request.sourceFields?.length) {
    throw new ModuleError({
      ...errors.EMBEDDING_CONFIG_INVALID,
      message: 'schemaName, targetField, and sourceFields are required',
    });
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(request.schemaName)) {
    throw new ModuleError({
      ...errors.EMBEDDING_CONFIG_INVALID,
      message: 'schemaName is invalid',
    });
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(request.targetField)) {
    throw new ModuleError({
      ...errors.EMBEDDING_CONFIG_INVALID,
      message: 'targetField is invalid',
    });
  }
  const { name: provider, settings: providerSettings } = assertConfiguredProvider(
    defaults.providers,
    request.provider || defaults.provider,
  );
  const model = resolveCatalogueModel(providerSettings, request.model);
  const dimensions = resolveCatalogueDimensions(model, request.dimensions);
  const similarity = request.similarity || VectorSimilarity.Cosine;
  if (!SUPPORTED_SIMILARITY.includes(similarity as VectorSimilarity)) {
    throw new ModuleError({
      ...errors.EMBEDDING_CONFIG_INVALID,
      message: `Unsupported similarity '${similarity}'. Supported values: ${SUPPORTED_SIMILARITY.join(', ')}`,
    });
  }
  const sourceFieldAllowlist = (request.sourceFieldAllowlist ?? []).filter(
    field => typeof field === 'string' && field.length > 0,
  );
  if (schemaFields) {
    assertSourceFields({
      sourceFields: request.sourceFields,
      schemaFields,
      allowlist: sourceFieldAllowlist,
    });
  }
  return {
    schemaName: request.schemaName,
    sourceFields: request.sourceFields,
    targetField: request.targetField,
    provider,
    modelName: model.name,
    dimensions,
    similarity: similarity as VectorSimilarity,
    sourceFieldAllowlist,
  };
}
