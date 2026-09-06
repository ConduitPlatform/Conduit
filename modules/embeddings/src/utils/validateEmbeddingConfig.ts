import { GrpcError, VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
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
  modelName: string | undefined;
  dimensions: number;
  similarity: VectorSimilarity;
  sourceFieldAllowlist: string[];
}

const SUPPORTED_SIMILARITY = Object.values(VectorSimilarity);

export function validateEmbeddingConfigInput(
  request: EmbeddingConfigInput,
  defaults: { provider: string },
  schemaFields?: Record<string, unknown>,
): ValidatedEmbeddingConfig {
  if (!request.schemaName || !request.targetField || !request.sourceFields?.length) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'schemaName, targetField, and sourceFields are required',
    );
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(request.schemaName)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'schemaName is invalid');
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(request.targetField)) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'targetField is invalid');
  }
  const dimensions = request.dimensions;
  if (
    typeof dimensions !== 'number' ||
    !Number.isInteger(dimensions) ||
    dimensions <= 0
  ) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'dimensions must be a positive integer');
  }
  const similarity = request.similarity || VectorSimilarity.Cosine;
  if (!SUPPORTED_SIMILARITY.includes(similarity as VectorSimilarity)) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Unsupported similarity '${similarity}'. Supported values: ${SUPPORTED_SIMILARITY.join(', ')}`,
    );
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
    provider: request.provider || defaults.provider,
    modelName: request.model,
    dimensions,
    similarity: similarity as VectorSimilarity,
    sourceFieldAllowlist,
  };
}
