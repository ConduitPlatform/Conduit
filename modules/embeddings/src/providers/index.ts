import { createHash } from 'node:crypto';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
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
  allowedHosts?: string[];
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

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly deps: EmbeddingProviderDependencies = {}) {}

  async embed(input: string, config: EmbeddingProviderConfig): Promise<number[]> {
    if (!config.endpoint) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'Embedding provider endpoint is not configured',
      );
    }
    const maxInput = config.maxInputBytes ?? DEFAULT_MAX_EMBED_INPUT_BYTES;
    if (Buffer.byteLength(input) > maxInput) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Embedding input exceeds the allowed size',
      );
    }
    await assertSafeEmbeddingEndpoint(config.endpoint, {
      allowedHosts: config.allowedHosts ?? [],
      lookup: this.deps.lookup,
    });
    const timeoutMs = config.timeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;
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
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (err instanceof GrpcError) throw err;
      const message = sanitizeErrorMessage(err);
      if (/redirect/i.test(message)) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Embedding provider redirects are not allowed',
        );
      }
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new GrpcError(
          status.DEADLINE_EXCEEDED,
          'Embedding provider request timed out',
        );
      }
      throw new GrpcError(status.UNAVAILABLE, message);
    }
    if (!response.ok) {
      throw new GrpcError(
        status.UNAVAILABLE,
        `Embedding provider failed with HTTP ${response.status}`,
      );
    }
    const bodyText = await readCappedResponse(
      response,
      config.maxResponseBytes ?? DEFAULT_MAX_EMBED_RESPONSE_BYTES,
    );
    let body: { data?: { embedding?: number[] }[] };
    try {
      body = JSON.parse(bodyText) as { data?: { embedding?: number[] }[] };
    } catch {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Embedding provider response was not valid JSON',
      );
    }
    const embedding = body.data?.[0]?.embedding;
    if (!embedding?.length) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Embedding provider response did not include an embedding',
      );
    }
    return embedding;
  }
}

export function getProvider(
  name: string,
  deps: EmbeddingProviderDependencies = {},
): EmbeddingProvider {
  if (name === 'openai-compatible') return new OpenAICompatibleEmbeddingProvider(deps);
  throw new GrpcError(status.INVALID_ARGUMENT, `Unsupported embedding provider: ${name}`);
}

export function hashEmbeddingInput(input: string) {
  return createHash('sha256').update(input).digest('hex');
}
