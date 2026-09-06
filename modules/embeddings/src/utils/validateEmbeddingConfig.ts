import { VectorSimilarity } from '@conduitplatform/grpc-sdk';

export interface EmbeddingConfigInput {
  schemaName?: string;
  sourceFields?: string[];
  targetField?: string;
  provider?: string;
  model?: string;
  dimensions?: number;
  similarity?: string;
}

export interface ValidatedEmbeddingConfig {
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  modelName: string | undefined;
  dimensions: number;
  similarity: VectorSimilarity;
}

const SUPPORTED_SIMILARITY = Object.values(VectorSimilarity);

export function validateEmbeddingConfigInput(
  request: EmbeddingConfigInput,
  defaults: { provider: string },
): ValidatedEmbeddingConfig {
  if (!request.schemaName || !request.targetField || !request.sourceFields?.length) {
    throw new Error('schemaName, targetField, and sourceFields are required');
  }
  const dimensions = request.dimensions;
  if (
    typeof dimensions !== 'number' ||
    !Number.isInteger(dimensions) ||
    dimensions <= 0
  ) {
    throw new Error('dimensions must be a positive integer');
  }
  const similarity = request.similarity || VectorSimilarity.Cosine;
  if (!SUPPORTED_SIMILARITY.includes(similarity as VectorSimilarity)) {
    throw new Error(
      `Unsupported similarity '${similarity}'. Supported values: ${SUPPORTED_SIMILARITY.join(', ')}`,
    );
  }
  return {
    schemaName: request.schemaName,
    sourceFields: request.sourceFields,
    targetField: request.targetField,
    provider: request.provider || defaults.provider,
    modelName: request.model,
    dimensions,
    similarity: similarity as VectorSimilarity,
  };
}
