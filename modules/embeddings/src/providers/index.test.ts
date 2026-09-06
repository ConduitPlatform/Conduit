import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { OpenAICompatibleEmbeddingProvider } from './index.js';

describe('openai-compatible provider security', () => {
  const provider = new OpenAICompatibleEmbeddingProvider({
    lookup: async () => [{ address: '104.18.0.1', family: 4 }],
    fetch: async () => {
      throw new Error('redirect not allowed');
    },
  });

  it('rejects redirects, oversize input, and missing allowlists', async () => {
    await assert.rejects(
      () =>
        provider.embed('hello', {
          endpoint: 'https://api.openai.com/v1/embeddings',
          allowedHosts: ['api.openai.com'],
        }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      () =>
        provider.embed('x'.repeat(100), {
          endpoint: 'https://api.openai.com/v1/embeddings',
          allowedHosts: ['api.openai.com'],
          maxInputBytes: 8,
        }),
      err => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    await assert.rejects(
      () =>
        provider.embed('hello', {
          endpoint: 'https://api.openai.com/v1/embeddings',
          allowedHosts: [],
        }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });

  it('returns embeddings when the allowlisted HTTPS endpoint is safe', async () => {
    const safe = new OpenAICompatibleEmbeddingProvider({
      lookup: async () => [{ address: '104.18.0.1', family: 4 }],
      fetch: async (_url, init) => {
        assert.equal(init?.redirect, 'error');
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
          status: 200,
        });
      },
    });
    const vector = await safe.embed('hello', {
      endpoint: 'https://api.openai.com/v1/embeddings',
      allowedHosts: ['api.openai.com'],
      apiKey: 'sk-test',
    });
    assert.deepEqual(vector, [0.1, 0.2]);
  });
});
