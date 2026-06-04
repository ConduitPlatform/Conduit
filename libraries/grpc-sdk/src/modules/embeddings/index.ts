import { ConduitModule } from '../../classes/index.js';
import { EmbeddingsProviderDefinition } from '../../protoUtils/embeddings.js';
import type { Indexable, VectorSearchResult } from '../../interfaces/index.js';

export interface EmbeddingConfigInput {
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  model: string;
  dimensions: number;
  similarity?: string;
}

export interface SemanticSearchInput {
  schemaName: string;
  text: string;
  targetField?: string;
  filter?: Indexable;
  limit?: number;
  userId?: string;
  scope?: string;
}

export class EmbeddingsProvider extends ConduitModule<
  typeof EmbeddingsProviderDefinition
> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'embeddings', url, grpcToken);
    this.initializeClient(EmbeddingsProviderDefinition);
  }

  upsertConfig(config: EmbeddingConfigInput): Promise<string> {
    return this.client!.upsertConfig(config).then(res => res.result);
  }

  getConfigs<T = Indexable>(): Promise<T[]> {
    return this.client!.getConfigs({}).then(res => JSON.parse(res.result));
  }

  startBackfill(schemaName: string, batchSize?: number): Promise<{ queued: number }> {
    return this.client!.startBackfill({ schemaName, batchSize }).then(res =>
      JSON.parse(res.result),
    );
  }

  semanticSearch<T = Indexable>(
    input: SemanticSearchInput,
  ): Promise<VectorSearchResult<T>[]> {
    return this.client!.semanticSearch({
      schemaName: input.schemaName,
      text: input.text,
      targetField: input.targetField,
      filter: input.filter ? JSON.stringify(input.filter) : undefined,
      limit: input.limit,
      userId: input.userId,
      scope: input.scope,
    }).then(res => JSON.parse(res.result));
  }
}
