import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { getConduitCode, parseErrorPayload } from '@conduitplatform/grpc-sdk';
import { errors } from '../errors.js';
import { BackfillGateError } from './backfillGates.js';
import { SearchGateError } from './operationalStatus.js';
import { sanitizeErrorMessage } from './redactConfig.js';
import { EmbeddingsApi } from '../api/embeddingsApi.js';

describe('embeddings error catalog', () => {
  it('keeps every entry typed with its own conduitCode', () => {
    for (const [key, definition] of Object.entries(errors)) {
      assert.equal(definition.conduitCode, key);
      assert.ok(definition.message.length > 0);
      assert.ok(definition.description.length > 0);
    }
  });

  it('blames the provider, not the caller, for malformed provider responses', () => {
    assert.equal(errors.EMBEDDING_PROVIDER_RESPONSE_INVALID.grpcCode, status.UNAVAILABLE);
    assert.equal(errors.BACKFILL_REQUEST_INVALID.grpcCode, status.INVALID_ARGUMENT);
  });

  it('answers gate failures with typed FAILED_PRECONDITION errors', () => {
    const backfill = new BackfillGateError('vector_storage_unavailable');
    assert.equal(backfill.code, status.FAILED_PRECONDITION);
    assert.equal(getConduitCode(backfill), 'VECTOR_UNAVAILABLE');
    const search = new SearchGateError('config_not_found');
    assert.equal(search.code, status.FAILED_PRECONDITION);
    assert.equal(getConduitCode(search), 'ENABLED_EMBEDDING_CONFIG_NOT_FOUND');
  });

  it('keeps human text readable for warnings and persisted run errors', () => {
    const gate = new BackfillGateError('module_disabled');
    assert.equal(sanitizeErrorMessage(gate), 'Embeddings module is disabled');
    assert.equal(
      parseErrorPayload(new BackfillGateError('index_not_queryable', 'custom text'))
        .message,
      'custom text',
    );
    assert.equal(
      sanitizeErrorMessage(new Error('boom apiKey=abc')),
      'boom apiKey:[REDACTED]',
    );
  });

  it('maps gRPC callback errors without leaking raw text', () => {
    const api = Object.create(EmbeddingsApi.prototype) as EmbeddingsApi;
    const typed = api.mapGrpcError(new SearchGateError('module_disabled'));
    assert.equal(typed.code, status.FAILED_PRECONDITION);
    assert.equal(getConduitCode(typed), 'EMBEDDINGS_MODULE_DISABLED');
    const untyped = api.mapGrpcError(new Error('redis password=hunter2'));
    assert.equal(untyped.code, status.INTERNAL);
    assert.equal(getConduitCode(untyped), 'EMBEDDINGS_OPERATION_FAILED');
    assert.doesNotMatch(untyped.message, /hunter2/);
  });
});
