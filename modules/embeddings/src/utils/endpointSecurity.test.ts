import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertSafeEmbeddingEndpoint,
  isBlockedIp,
  readCappedResponse,
} from './endpointSecurity.js';

describe('embedding endpoint SSRF controls', () => {
  it('blocks private, link-local, and metadata addresses', () => {
    assert.equal(isBlockedIp('127.0.0.1'), true);
    assert.equal(isBlockedIp('10.0.0.5'), true);
    assert.equal(isBlockedIp('192.168.1.20'), true);
    assert.equal(isBlockedIp('169.254.169.254'), true);
    assert.equal(isBlockedIp('::1'), true);
    assert.equal(isBlockedIp('::ffff:127.0.0.1'), true);
    assert.equal(isBlockedIp('8.8.8.8'), false);
  });

  it('requires HTTPS and an allowlisted host', async () => {
    await assert.rejects(
      () =>
        assertSafeEmbeddingEndpoint('http://api.openai.com/v1/embeddings', {
          allowedHosts: ['api.openai.com'],
        }),
      err => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    await assert.rejects(
      () =>
        assertSafeEmbeddingEndpoint('https://evil.example/v1/embeddings', {
          allowedHosts: ['api.openai.com'],
        }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });

  it('rejects DNS results that resolve to private or metadata addresses', async () => {
    await assert.rejects(
      () =>
        assertSafeEmbeddingEndpoint('https://api.openai.com/v1/embeddings', {
          allowedHosts: ['api.openai.com'],
          lookup: async () => [{ address: '169.254.169.254', family: 4 }],
        }),
      err => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    const url = await assertSafeEmbeddingEndpoint(
      'https://api.openai.com/v1/embeddings',
      {
        allowedHosts: ['api.openai.com'],
        lookup: async () => [{ address: '104.18.0.1', family: 4 }],
      },
    );
    assert.equal(url.hostname, 'api.openai.com');
  });

  it('caps response payload size', async () => {
    const response = new Response('x'.repeat(20), { status: 200 });
    await assert.rejects(
      () => readCappedResponse(response, 8),
      err => err instanceof GrpcError && err.code === status.RESOURCE_EXHAUSTED,
    );
  });
});
