export const MATERIAL_EMBEDDING_CONFIG_FIELDS = [
  'provider',
  'modelName',
  'dimensions',
  'sourceFields',
  'targetField',
  'similarity',
] as const;

export type MaterialEmbeddingConfigField =
  (typeof MATERIAL_EMBEDDING_CONFIG_FIELDS)[number];

export interface MaterialEmbeddingConfig {
  provider: string;
  modelName?: string;
  dimensions: number;
  sourceFields: readonly string[];
  targetField: string;
  similarity?: string;
}

export function normalizeSourceFields(fields: readonly string[]): string[] {
  return [...fields].map(field => field.trim()).sort();
}

export function embeddingConfigFingerprint(config: MaterialEmbeddingConfig): string {
  return JSON.stringify({
    provider: config.provider,
    model: config.modelName ?? '',
    dimensions: config.dimensions,
    sourceFields: normalizeSourceFields(config.sourceFields),
    targetField: config.targetField,
    similarity: config.similarity ?? '',
  });
}

export function hashedEmbeddingSource(
  hashInput: (input: string) => string,
  input: string,
  config: MaterialEmbeddingConfig,
): string {
  return hashInput(`${embeddingConfigFingerprint(config)}\n${input}`);
}

export function sameSourceFields(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  return (
    JSON.stringify(normalizeSourceFields(left ?? [])) ===
    JSON.stringify(normalizeSourceFields(right ?? []))
  );
}

export function diffMaterialEmbeddingConfig(
  existing: MaterialEmbeddingConfig,
  next: MaterialEmbeddingConfig,
): MaterialEmbeddingConfigField[] {
  const changed: MaterialEmbeddingConfigField[] = [];
  if (existing.provider !== next.provider) changed.push('provider');
  if ((existing.modelName ?? '') !== (next.modelName ?? '')) changed.push('modelName');
  if (existing.dimensions !== next.dimensions) changed.push('dimensions');
  if (!sameSourceFields(existing.sourceFields, next.sourceFields)) {
    changed.push('sourceFields');
  }
  if (existing.targetField !== next.targetField) changed.push('targetField');
  if ((existing.similarity ?? '') !== (next.similarity ?? '')) {
    changed.push('similarity');
  }
  return changed;
}

export function requiresIndexRecreation(
  changed: readonly MaterialEmbeddingConfigField[],
): boolean {
  return changed.some(
    field => field === 'dimensions' || field === 'targetField' || field === 'similarity',
  );
}

export function isInPlaceDimensionChange(
  existing: MaterialEmbeddingConfig,
  next: MaterialEmbeddingConfig,
): boolean {
  return (
    existing.targetField === next.targetField && existing.dimensions !== next.dimensions
  );
}

export function hashFieldsToInvalidate(
  existing: MaterialEmbeddingConfig,
  next: MaterialEmbeddingConfig,
): string[] {
  const fields = new Set<string>([
    `${existing.targetField}SourceHash`,
    `${next.targetField}SourceHash`,
  ]);
  return [...fields];
}

export function defaultEmbeddingVectorIndexName(field: string): string {
  return `${field}_vector`;
}

export function materialChangeWarnings(
  changed: readonly MaterialEmbeddingConfigField[],
  scheduledBackfill: boolean,
): string[] {
  if (!changed.length) return [];
  const warnings = [
    `Material embedding config change (${changed.join(', ')}) invalidated stored source hashes. ` +
      'Existing vectors are stale until an explicit backfill completes.',
  ];
  if (requiresIndexRecreation(changed)) {
    warnings.push(
      'Vector index recreation is required for this change. Wait until the index is queryable before searching or backfilling.',
    );
  }
  if (!scheduledBackfill) {
    warnings.push(
      'Start an explicit backfill after the vector index is queryable. Stale vectors will not be reused by hash skip.',
    );
  } else {
    warnings.push('An explicit backfill was scheduled for this config.');
  }
  return warnings;
}
