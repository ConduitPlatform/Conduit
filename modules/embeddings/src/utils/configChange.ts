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

export function parseEmbeddingVectorIndexName(name: string): {
  base: string;
  generation: number;
} {
  const match = /^(.*)_v(\d+)$/.exec(name);
  if (match) {
    return { base: match[1], generation: Number(match[2]) };
  }
  return { base: name, generation: 1 };
}

export function embeddingVectorIndexGeneration(name?: string): number {
  if (typeof name !== 'string' || name.length === 0) return 0;
  return parseEmbeddingVectorIndexName(name).generation;
}

export function sameEmbeddingVectorIndexFamily(left: string, right: string): boolean {
  return (
    parseEmbeddingVectorIndexName(left).base === parseEmbeddingVectorIndexName(right).base
  );
}

export function nextEmbeddingVectorIndexName(
  field: string,
  indexes: ReadonlyArray<{ field?: string; name?: string }>,
): string {
  const names = indexes
    .filter(
      index =>
        index.field === field && typeof index.name === 'string' && index.name.length > 0,
    )
    .map(index => index.name as string);
  if (!names.length) return defaultEmbeddingVectorIndexName(field);
  let base = defaultEmbeddingVectorIndexName(field);
  let maxGeneration = 0;
  for (const name of names) {
    const parsed = parseEmbeddingVectorIndexName(name);
    if (parsed.generation >= maxGeneration) {
      maxGeneration = parsed.generation;
      base = parsed.base;
    }
  }
  return `${base}_v${maxGeneration + 1}`;
}

export function selectEmbeddingVectorIndex<T extends { field?: string; name?: string }>(
  indexes: readonly T[],
  field: string,
): T | undefined {
  const matches = indexes.filter(index => index.field === field);
  if (!matches.length) return undefined;
  const defaultName = defaultEmbeddingVectorIndexName(field);
  return matches.reduce((best, current) => {
    const bestGeneration = embeddingVectorIndexGeneration(best.name);
    const currentGeneration = embeddingVectorIndexGeneration(current.name);
    if (currentGeneration !== bestGeneration) {
      return currentGeneration > bestGeneration ? current : best;
    }
    if (current.name === defaultName) return current;
    if (best.name === defaultName) return best;
    return best;
  });
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
