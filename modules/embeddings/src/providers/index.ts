import { createHash } from 'node:crypto';

export interface EmbeddingProviderConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

export interface EmbeddingProvider {
  embed(input: string, config: EmbeddingProviderConfig): Promise<number[]>;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  async embed(input: string, config: EmbeddingProviderConfig): Promise<number[]> {
    if (!config.endpoint) {
      throw new Error('Embedding provider endpoint is not configured');
    }
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        input,
        model: config.model,
      }),
    });
    if (!response.ok) {
      throw new Error(`Embedding provider failed with HTTP ${response.status}`);
    }
    const body = (await response.json()) as { data?: { embedding?: number[] }[] };
    const embedding = body.data?.[0]?.embedding;
    if (!embedding?.length) {
      throw new Error('Embedding provider response did not include an embedding');
    }
    return embedding;
  }
}

export function getProvider(name: string): EmbeddingProvider {
  if (name === 'openai-compatible') return new OpenAICompatibleEmbeddingProvider();
  throw new Error(`Unsupported embedding provider: ${name}`);
}

export function hashEmbeddingInput(input: string) {
  return createHash('sha256').update(input).digest('hex');
}
