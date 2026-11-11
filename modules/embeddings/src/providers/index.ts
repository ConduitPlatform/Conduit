import { createHash } from 'node:crypto';
import { isGrpcStatusError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  assertSafeEmbeddingEndpoint,
  DEFAULT_EMBED_TIMEOUT_MS,
  DEFAULT_MAX_EMBED_INPUT_BYTES,
  DEFAULT_MAX_EMBED_RESPONSE_BYTES,
  readCappedResponse,
  type SafeEndpointOptions,
} from '../utils/endpointSecurity.js';
import { sanitizeErrorMessage } from '../utils/redactConfig.js';

export interface EmbeddingProviderConfig {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxInputBytes?: number;
  maxResponseBytes?: number;
}

export interface EmbeddingProvider {
  embed(input: string, config: EmbeddingProviderConfig): Promise<number[]>;
}

export type EmbeddingFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface EmbeddingProviderDependencies {
  fetch?: EmbeddingFetch;
  lookup?: SafeEndpointOptions['lookup'];
}

function mapEmbedFetchError(err: unknown): never {
  if (isGrpcStatusError(err)) throw err;
  const message = sanitizeErrorMessage(err);
  if (/redirect/i.test(message)) {
    throw new ModuleError(errors.EMBEDDING_PROVIDER_REDIRECT_BLOCKED);
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    throw new ModuleError(errors.EMBEDDING_PROVIDER_TIMEOUT);
  }
  throw new ModuleError(errors.EMBEDDING_PROVIDER_UNAVAILABLE, message);
}

function parseEmbeddingResponse(bodyText: string): number[] {
  let body: { data?: { embedding?: number[] }[] };
  try {
    body = JSON.parse(bodyText) as { data?: { embedding?: number[] }[] };
  } catch {
    throw new ModuleError(
      errors.EMBEDDING_PROVIDER_RESPONSE_INVALID,
      'Embedding provider response was not valid JSON',
    );
  }
  const embedding = body.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new ModuleError(
      errors.EMBEDDING_PROVIDER_RESPONSE_INVALID,
      'Embedding provider response did not include an embedding',
    );
  }
  return embedding;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly deps: EmbeddingProviderDependencies = {}) {}

  async embed(input: string, config: EmbeddingProviderConfig): Promise<number[]> {
    if (!config.endpoint) {
      throw new ModuleError(errors.EMBEDDING_PROVIDER_ENDPOINT_NOT_CONFIGURED);
    }
    if (
      Buffer.byteLength(input) > (config.maxInputBytes ?? DEFAULT_MAX_EMBED_INPUT_BYTES)
    ) {
      throw new ModuleError(errors.EMBEDDING_INPUT_TOO_LARGE);
    }
    await assertSafeEmbeddingEndpoint(config.endpoint, {
      lookup: this.deps.lookup,
    });
    const fetchImpl = this.deps.fetch ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          input,
          model: config.model,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS),
      });
    } catch (err) {
      mapEmbedFetchError(err);
    }
    if (!response.ok) {
      throw new ModuleError(
        errors.EMBEDDING_PROVIDER_UNAVAILABLE,
        `Embedding provider failed with HTTP ${response.status}`,
      );
    }
    return parseEmbeddingResponse(
      await readCappedResponse(
        response,
        config.maxResponseBytes ?? DEFAULT_MAX_EMBED_RESPONSE_BYTES,
      ),
    );
  }
}

export function getProvider(
  name: string,
  deps: EmbeddingProviderDependencies = {},
): EmbeddingProvider {
  if (name === 'openai-compatible') return new OpenAICompatibleEmbeddingProvider(deps);
  throw new ModuleError(
    errors.EMBEDDING_PROVIDER_INVALID,
    `Unsupported embedding provider: ${name}`,
  );
}

export function hashEmbeddingInput(input: string) {
  return createHash('sha256').update(input).digest('hex');
}
