import { hashedEmbeddingSource } from './configChange.js';

export interface EmbeddingConfigLike {
  sourceFields: string[];
  targetField: string;
  dimensions: number;
  provider: string;
  modelName?: string;
  similarity?: string;
}

export interface EmbeddingGenerationResult {
  generated: number;
  skipped: number;
}

export function buildEmbeddingDocumentSelect(
  configs: Array<{ sourceFields: string[]; targetField: string }>,
): string {
  const fields = new Set<string>();
  for (const config of configs) {
    for (const field of config.sourceFields) {
      fields.add(`+${field}`);
    }
    fields.add(`+${config.targetField}SourceHash`);
  }
  return [...fields].join(' ');
}

export function sourceHashField(targetField: string): string {
  return `${targetField}SourceHash`;
}

export function buildEmbeddingInput(
  doc: Record<string, unknown>,
  sourceFields: string[],
): string {
  return sourceFields.map(field => doc[field] ?? '').join('\n');
}

export function shouldSkipEmbedding(
  doc: Record<string, unknown>,
  targetField: string,
  sourceHash: string,
): boolean {
  return doc[sourceHashField(targetField)] === sourceHash;
}

export async function generateEmbeddingsForDocument(args: {
  doc: Record<string, unknown>;
  configs: EmbeddingConfigLike[];
  hashInput: (input: string) => string;
  embed: (input: string, config: EmbeddingConfigLike) => Promise<number[]>;
  update: (
    fields: Record<string, unknown>,
    options: { suppressEvent: true },
  ) => Promise<unknown>;
}): Promise<EmbeddingGenerationResult> {
  let generated = 0;
  let skipped = 0;
  for (const config of args.configs) {
    const input = buildEmbeddingInput(args.doc, config.sourceFields);
    const sourceHash = hashedEmbeddingSource(args.hashInput, input, config);
    if (shouldSkipEmbedding(args.doc, config.targetField, sourceHash)) {
      skipped += 1;
      continue;
    }
    const vector = await args.embed(input, config);
    if (vector.length !== config.dimensions) {
      throw new Error(
        `Embedding provider returned ${vector.length} dimensions; expected ${config.dimensions}`,
      );
    }
    const hashField = sourceHashField(config.targetField);
    await args.update(
      {
        [config.targetField]: vector,
        [hashField]: sourceHash,
      },
      { suppressEvent: true },
    );
    args.doc[hashField] = sourceHash;
    args.doc[config.targetField] = vector;
    generated += 1;
  }
  return { generated, skipped };
}
