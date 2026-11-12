import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasConduitCode } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { OpenAICompatibleEmbeddingProvider } from './index.js';

describe('openai-compatible provider security', () => {
  const provider = new OpenAICompatibleEmbeddingProvider({
    lookup: async () => [{ address: '104.18.0.1', family: 4 }],
    fetch: async () => {
      throw new Error('redirect not allowed');
    },
  });

  it('rejects redirects, oversize input, and blocked endpoints', async () => {
    await assert.rejects(
      () =>
        provider.embed('hello', {
          endpoint: 'https://api.openai.com/v1/embeddings',
        }),
      err =>
        hasConduitCode(err, 'EMBEDDING_PROVIDER_REDIRECT_BLOCKED') &&
        (err as ModuleError).code === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      () =>
        provider.embed('x'.repeat(100), {
          endpoint: 'https://api.openai.com/v1/embeddings',
          maxInputBytes: 8,
        }),
      err =>
        hasConduitCode(err, 'EMBEDDING_INPUT_TOO_LARGE') &&
        (err as ModuleError).code === status.INVALID_ARGUMENT,
    );
    await assert.rejects(
      () =>
        provider.embed('hello', {
          endpoint: 'https://127.0.0.1/v1/embeddings',
        }),
      err =>
        hasConduitCode(err, 'EMBEDDING_ENDPOINT_ADDRESS_BLOCKED') &&
        (err as ModuleError).code === status.PERMISSION_DENIED,
    );
  });

  it('returns embeddings from a public HTTPS endpoint using the selected model', async () => {
    const safe = new OpenAICompatibleEmbeddingProvider({
      lookup: async () => [{ address: '104.18.0.1', family: 4 }],
      fetch: async (_url, init) => {
        assert.equal(init?.redirect, 'error');
        const headers = new Headers(init?.headers);
        assert.equal(headers.get('authorization'), 'Bearer sk-test');
        const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
        assert.equal(body.model, 'text-embedding-3-small');
        return new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), {
          status: 200,
        });
      },
    });
    const vector = await safe.embed('hello', {
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
    });
    assert.deepEqual(vector, [0.1, 0.2]);
  });

  it('maps provider HTTP failures without leaking the API key', async () => {
    const failing = new OpenAICompatibleEmbeddingProvider({
      lookup: async () => [{ address: '104.18.0.1', family: 4 }],
      fetch: async () =>
        new Response('invalid apiKey=sk-test', {
          status: 401,
          headers: { 'content-type': 'text/plain' },
        }),
    });
    await assert.rejects(
      () =>
        failing.embed('hello', {
          endpoint: 'https://api.openai.com/v1/embeddings',
          apiKey: 'sk-test',
          model: 'text-embedding-3-small',
        }),
      err =>
        err instanceof ModuleError &&
        err.code === status.UNAVAILABLE &&
        err.conduitCode === 'EMBEDDING_PROVIDER_UNAVAILABLE' &&
        /HTTP 401/.test(err.debugLogInfo ?? '') &&
        !err.message.includes('sk-test') &&
        !err.message.includes('HTTP 401'),
    );
  });
});
